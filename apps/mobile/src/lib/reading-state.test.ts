import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// AsyncStorage 是原生模块，vitest 下必须 mock（看板踩坑点 13）
const storage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));
vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test" }));
vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => ({ token: "t-1" }) },
}));

import {
  READING_STATE_KEY,
  continueReading,
  emptyReadingStore,
  isFavorite,
  markRead,
  markTopicRead,
  mergeRemote,
  pendingCount,
  pushPendingOps,
  readStateOf,
  toggleFavorite,
  trackReadingSummary,
  type ReadingPointRef,
} from "./reading-state";

const python: ReadingPointRef = {
  pointKey: "python/python-foundation/python-values-control",
  trackSlug: "python",
  stageKey: "python-foundation",
  topicKey: "python-values-control",
};
const java: ReadingPointRef = {
  pointKey: "java/java-foundation/java-types-control",
  trackSlug: "java",
  stageKey: "java-foundation",
  topicKey: "java-types-control",
};

const t1 = new Date("2026-10-10T08:00:00.000Z");
const t2 = new Date("2026-10-10T09:00:00.000Z");

beforeEach(() => storage.clear());
afterEach(() => vi.restoreAllMocks());

describe("markRead（本地优先）", () => {
  it("首次阅读：progress/first/last/readCount 都合理", () => {
    const store = markRead(emptyReadingStore(), { ...python, progress: 40 }, t1);
    const state = readStateOf(store, python.pointKey)!;
    expect(state.progress).toBe(40);
    expect(state.readCount).toBe(1);
    expect(state.firstReadAt).toBe(t1.toISOString());
    expect(state.lastReadAt).toBe(t1.toISOString());
    expect(pendingCount(store)).toBe(1);
  });

  it("重复阅读：进度只增不减、firstReadAt 不变、readCount 递增", () => {
    let store = markRead(emptyReadingStore(), { ...python, progress: 90 }, t1);
    store = markRead(store, { ...python, progress: 20 }, t2);
    const state = readStateOf(store, python.pointKey)!;
    expect(state.progress).toBe(90);
    expect(state.firstReadAt).toBe(t1.toISOString());
    expect(state.lastReadAt).toBe(t2.toISOString());
    expect(state.readCount).toBe(2);
  });

  it("progress 越界与非法值被夹住", () => {
    const over = markRead(emptyReadingStore(), { ...python, progress: 999 }, t1);
    expect(readStateOf(over, python.pointKey)!.progress).toBe(100);
    const illegal = markRead(emptyReadingStore(), { ...python, progress: Number.NaN }, t1);
    expect(readStateOf(illegal, python.pointKey)!.progress).toBe(0);
  });
});

describe("toggleFavorite", () => {
  it("收藏→取消→再收藏，pending op 依次记录真实意图", () => {
    let store = toggleFavorite(emptyReadingStore(), python, t1);
    expect(isFavorite(store, python.pointKey)).toBe(true);
    store = toggleFavorite(store, python, t2);
    expect(isFavorite(store, python.pointKey)).toBe(false);
    expect(store.pending.map((op) => (op.kind === "favorite" ? op.favorite : null))).toEqual([true, false]);
  });
});

describe("continueReading / trackReadingSummary", () => {
  it("取最近读过且未读完的一节", () => {
    let store = markRead(emptyReadingStore(), { ...python, progress: 100 }, t1);
    store = markRead(store, { ...java, progress: 30 }, t2);
    expect(continueReading(store)?.pointKey).toBe(java.pointKey);
    expect(continueReading(markRead(emptyReadingStore(), { ...python, progress: 100 }, t1))).toBeNull();
  });

  it("按课程聚合已读与收藏", () => {
    let store = markRead(emptyReadingStore(), { ...python, progress: 10 }, t1);
    store = markRead(store, { ...java, progress: 10 }, t1);
    store = toggleFavorite(store, java, t1);
    expect(trackReadingSummary(store, "python")).toEqual({ read: [python.pointKey], favorites: [] });
    expect(trackReadingSummary(store, "java")).toEqual({ read: [java.pointKey], favorites: [java.pointKey] });
  });
});

describe("mergeRemote", () => {
  it("两边取更完整的值，并清空 pending", () => {
    const local = markRead(emptyReadingStore(), { ...python, progress: 60 }, t2);
    const merged = mergeRemote(local, {
      read: [
        {
          ...python,
          firstReadAt: t1.toISOString(),
          lastReadAt: t1.toISOString(),
          progress: 80,
          readCount: 5,
        },
      ],
      favorites: [{ ...java, note: null, createdAt: t1.toISOString() }],
      counts: { read: 1, favorites: 1, readThisWeek: 1 },
    });
    const state = readStateOf(merged, python.pointKey)!;
    expect(state.progress).toBe(80);
    expect(state.firstReadAt).toBe(t1.toISOString()); // 取更早
    expect(state.lastReadAt).toBe(t2.toISOString()); // 取更晚
    expect(state.readCount).toBe(5);
    expect(isFavorite(merged, java.pointKey)).toBe(true);
    expect(pendingCount(merged)).toBe(0);
  });

  it("本地独有（服务端还没有）的记录不会被合并抹掉", () => {
    const local = markRead(emptyReadingStore(), { ...java, progress: 10 }, t2);
    const merged = mergeRemote(local, { read: [], favorites: [], counts: { read: 0, favorites: 0, readThisWeek: 0 } });
    expect(readStateOf(merged, java.pointKey)?.progress).toBe(10);
  });
});

describe("pushPendingOps", () => {
  it("逐条 POST，全部成功后 pending 清空", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    let store = markRead(emptyReadingStore(), { ...python, progress: 50 }, t1);
    store = toggleFavorite(store, python, t1);
    const result = await pushPendingOps(store);
    expect(result.pushed).toBe(2);
    expect(pendingCount(result.store)).toBe(0);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.test/api/learning/read",
      "https://api.test/api/learning/favorite",
    ]);
  });

  it("中途失败即停：失败那条与后续都保留（顺序不能乱）", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      call += 1;
      return new Response("{}", { status: call === 2 ? 500 : 201 });
    }));
    let store = markRead(emptyReadingStore(), { ...python, progress: 50 }, t1);
    store = toggleFavorite(store, python, t1);
    store = markRead(store, { ...java, progress: 10 }, t1);
    const result = await pushPendingOps(store);
    expect(result.pushed).toBe(1);
    expect(result.store.pending.map((op) => op.kind)).toEqual(["favorite", "read"]);
  });
});

describe("markTopicRead（落盘 + 推送）", () => {
  it("写入 AsyncStorage 且推送成功后不再留 pending", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 201 })));
    const store = await markTopicRead({ ...python, progress: 70 }, t1);
    expect(pendingCount(store)).toBe(0);
    expect(storage.get(READING_STATE_KEY)).toContain(python.pointKey);
  });

  it("未登录/离线：本地照样记下，pending 留着下次推", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const store = await markTopicRead({ ...python, progress: 70 }, t1);
    expect(pendingCount(store)).toBe(1);
    expect(readStateOf(store, python.pointKey)?.progress).toBe(70);
  });
});
