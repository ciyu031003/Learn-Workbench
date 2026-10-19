import { describe, it, expect, vi, beforeEach } from "vitest";

const { memory } = vi.hoisted(() => ({ memory: new Map<string, string>() }));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      memory.delete(key);
    }),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HEAVY_WRITE_BUDGET_BYTES,
  PENDING_QUEUE_LIMIT,
  buildPersistReport,
  isHeavyWriteOverBudget,
  mergePersistedState,
  normalizePendingQueue,
  splitPersistedState,
  summarizeRehydratedState,
  utf8ByteLength,
} from "./persist-core";
import {
  HEAVY_STORAGE_KEY,
  LIGHT_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  __resetPersistRuntimeForTests,
  createSplitStorage,
  getLastPersistReport,
  reportRehydrate,
  setPersistDiagnosticSink,
  subscribePersistReport,
} from "./persist";

const ch = (entityType: string, entityId: string, updatedAt: string) => ({
  entityType,
  entityId,
  operation: "UPDATE",
  version: 1,
  payload: {},
  updatedAt,
});

const seedState = () => ({
  token: "leak-me",
  username: "alice",
  ownerUserId: "alice",
  deviceId: "dev-1",
  apiUrl: null,
  themeMode: "dark",
  edgeSwipeEnabled: true,
  backgroundEnabled: true,
  lastSyncedAt: "2026-08-13T10:00:00.000Z",
  aiTip: null,
  progress: { 1: { topicId: 1, done: true, note: null, updatedAt: "2026-08-13T10:00:00.000Z" } },
  tasks: [{ id: 1, clientId: "c-1", title: "t" }],
  logs: [],
  sessions: [{ id: 1, clientId: "c-s1", durationSeconds: 1500 }],
  checkins: ["2026-08-13"],
  github: [],
  customTopics: [],
  sports: [],
  habits: [{ id: 1, clientId: "c-h1", name: "喝水" }],
  habitLogs: [{ entityId: "c-h1|2026-08-13", habitClientId: "c-h1", logDate: "2026-08-13", value: 1 }],
  pendingChanges: [ch("progress", "1", "2026-08-13T10:00:00.000Z")],
});

let diagnose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  memory.clear();
  __resetPersistRuntimeForTests();
  diagnose = vi.fn();
  setPersistDiagnosticSink(diagnose as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("persist-core 拆分 / 体积 / 队列归一化", () => {
  it("轻层只有偏好与会话元数据，重层只有业务数据 + 发件箱", () => {
    const { light, heavy } = splitPersistedState(seedState());
    expect(Object.keys(light).sort()).toEqual(
      ["aiTip", "apiUrl", "backgroundEnabled", "deviceId", "edgeSwipeEnabled", "lastSyncedAt", "ownerUserId", "themeMode", "token", "username"].sort()
    );
    expect(heavy.sessions).toHaveLength(1);
    expect(heavy.pendingChanges).toHaveLength(1);
    expect(heavy.habits).toHaveLength(1);
    expect(heavy.habitLogs).toHaveLength(1);
    expect(light.sessions).toBeUndefined();
  });

  it("merge 能还原完整 state", () => {
    const { light, heavy } = splitPersistedState(seedState());
    const merged = mergePersistedState(light, heavy);
    expect(merged.themeMode).toBe("dark");
    expect((merged.sessions as unknown[]).length).toBe(1);
  });

  it("utf8ByteLength 按 UTF-8 计（中文 3 字节 / emoji 4 字节 / ASCII 1 字节）", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("中文")).toBe(6);
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength("a中😀")).toBe(8);
  });

  it("1.5MB 预算判定", () => {
    expect(HEAVY_WRITE_BUDGET_BYTES).toBe(Math.round(1.5 * 1024 * 1024));
    expect(isHeavyWriteOverBudget(HEAVY_WRITE_BUDGET_BYTES)).toBe(false);
    expect(isHeavyWriteOverBudget(HEAVY_WRITE_BUDGET_BYTES + 1)).toBe(true);
  });

  it("buildPersistReport 自动标记超限", () => {
    const report = buildPersistReport(
      { source: "split", lightBytes: 100, heavyBytes: HEAVY_WRITE_BUDGET_BYTES + 10, lightChanged: true, heavyChanged: true, error: null },
      0
    );
    expect(report.heavyOverBudget).toBe(true);
    expect(report.at).toBe(new Date(0).toISOString());
  });

  it("同一实体只保留 updatedAt 最新的一条（时间相同保留靠前=更晚入队）", () => {
    const queue = [
      ch("tasks", "c-1", "2026-08-13T10:00:02.000Z"),
      ch("tasks", "c-1", "2026-08-13T10:00:01.000Z"),
      ch("progress", "1", "2026-08-13T10:00:01.000Z"),
      ch("tasks", "c-1", "2026-08-13T10:00:01.500Z"),
    ];
    const out = normalizePendingQueue(queue);
    expect(out).toHaveLength(2);
    expect(out[0].updatedAt).toBe("2026-08-13T10:00:02.000Z");
    expect(out[1].entityType).toBe("progress");
  });

  it("上限 " + PENDING_QUEUE_LIMIT + " 条：超出丢弃最旧（队列首=最新）", () => {
    const queue = Array.from({ length: PENDING_QUEUE_LIMIT + 25 }, (_, i) =>
      ch("sessions", "c-" + i, "2026-08-13T10:00:00.000Z")
    );
    const out = normalizePendingQueue(queue);
    expect(out).toHaveLength(PENDING_QUEUE_LIMIT);
    expect(out[0].entityId).toBe("c-0");
    expect(out[out.length - 1].entityId).toBe("c-" + (PENDING_QUEUE_LIMIT - 1));
  });
});

describe("双 key 存储", () => {
  it("setItem 拆成 light/heavy 两个 key，token 永不落盘", async () => {
    const storage = createSplitStorage();
    await storage.setItem("lwb-mobile-store", JSON.stringify({ state: seedState(), version: 0 }));

    const light = JSON.parse(memory.get(LIGHT_STORAGE_KEY) ?? "{}");
    const heavy = JSON.parse(memory.get(HEAVY_STORAGE_KEY) ?? "{}");
    expect(light.themeMode).toBe("dark");
    expect(light.token).toBeNull();
    expect(light.sessions).toBeUndefined();
    expect(heavy.sessions).toHaveLength(1);
    expect(heavy.pendingChanges).toHaveLength(1);
    expect(memory.has(LEGACY_STORAGE_KEY)).toBe(false);
  });

  it("getItem 把两份合并回 zustand 格式，且只写变化的一半", async () => {
    const storage = createSplitStorage();
    await storage.setItem("lwb-mobile-store", JSON.stringify({ state: seedState(), version: 0 }));
    const raw = await storage.getItem("lwb-mobile-store");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.themeMode).toBe("dark");
    expect(parsed.state.sessions).toHaveLength(1);

    // 只改偏好（heavy 不变）：不应重写 heavy key
    vi.mocked(AsyncStorage.setItem).mockClear();
    const next = { ...seedState(), themeMode: "light" };
    await storage.setItem("lwb-mobile-store", JSON.stringify({ state: next, version: 0 }));
    const writtenKeys = vi.mocked(AsyncStorage.setItem).mock.calls.map((c) => c[0]);
    expect(writtenKeys).toContain(LIGHT_STORAGE_KEY);
    expect(writtenKeys).not.toContain(HEAVY_STORAGE_KEY);
  });

  it("旧版单 key 自动迁移（拆两份 + 删旧 key + 抹掉 token）", async () => {
    memory.set(LEGACY_STORAGE_KEY, JSON.stringify({ state: seedState(), version: 0 }));
    const storage = createSplitStorage();
    const raw = await storage.getItem("lwb-mobile-store");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.sessions).toHaveLength(1);
    expect(parsed.state.token).toBeNull();
    expect(memory.has(LEGACY_STORAGE_KEY)).toBe(false);
    expect(memory.has(LIGHT_STORAGE_KEY)).toBe(true);
    expect(memory.has(HEAVY_STORAGE_KEY)).toBe(true);
    expect(getLastPersistReport()?.source).toBe("legacy");
  });

  it("heavy 数据损坏：回收 light 部分并记诊断（不阻塞启动）", async () => {
    memory.set(LIGHT_STORAGE_KEY, JSON.stringify({ state: { themeMode: "dark" }, version: 0 }));
    memory.set(HEAVY_STORAGE_KEY, "{broken json");
    const storage = createSplitStorage();
    const raw = await storage.getItem("lwb-mobile-store");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.themeMode).toBe("dark");
    expect(parsed.state.sessions).toBeUndefined();
    expect(diagnose).toHaveBeenCalledWith(expect.objectContaining({ kind: "heavy-parse-failed" }));
  });

  it("单次 heavy 写超 1.5MB 记诊断", async () => {
    const storage = createSplitStorage();
    const huge = {
      // 1.6MB 单字段（比 6000 条小记录更直接地越过预算线）
      sessions: [{ id: 1, clientId: "c-big", tag: "x".repeat(1_600_000) }],
      pendingChanges: [],
    };
    await storage.setItem("lwb-mobile-store", JSON.stringify({ state: huge, version: 0 }));
    expect(diagnose).toHaveBeenCalledWith(expect.objectContaining({ kind: "heavy-write-over-budget" }));
    expect(getLastPersistReport()?.heavyOverBudget).toBe(true);
  });

  it("恢复时超限：reportRehydrate 打告警", () => {
    reportRehydrate({ sessions: [{ id: 1, tag: "x".repeat(1_600_000) }] }, null);
    expect(diagnose).toHaveBeenCalledWith(expect.objectContaining({ kind: "rehydrate-over-budget" }));
  });

  it("恢复结果正常时上报条数摘要", () => {
    reportRehydrate({ tasks: [{}, {}], sessions: [{}], pendingChanges: [{}], habits: [{}], habitLogs: [] }, null);
    expect(diagnose).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "rehydrate", message: expect.stringContaining("任务 2") })
    );
    expect(summarizeRehydratedState({ tasks: [1], sessions: [1, 2] })).toMatchObject({ tasks: 1, sessions: 2 });
  });

  it("报告可订阅（状态条/设置页可读取最近一次写盘体积）", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePersistReport(listener);
    const storage = createSplitStorage();
    await storage.setItem("lwb-mobile-store", JSON.stringify({ state: seedState(), version: 0 }));
    expect(listener).toHaveBeenCalled();
    const report = getLastPersistReport();
    expect(report?.lightBytes).toBeGreaterThan(0);
    expect(report?.heavyBytes).toBeGreaterThan(report!.lightBytes);
    unsubscribe();
  });
});

describe("写体积性能（1000 条 sessions 单次写）", () => {
  it("1000 条 sessions 的拆分 + 序列化 + 字节统计 < 5ms", async () => {
    const sessions = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      clientId: "c-" + i,
      taskId: null,
      startedAt: "2026-08-13T09:00:00.000Z",
      endedAt: "2026-08-13T09:25:00.000Z",
      durationSeconds: 1500,
      tag: i % 3 === 0 ? null : "专注：算法练习",
    }));
    const state = { ...seedState(), sessions, pendingChanges: [] };
    const storage = createSplitStorage();
    const value = JSON.stringify({ state, version: 0 });

    // 预热（JIT）
    splitPersistedState(state);
    JSON.stringify(splitPersistedState(state).heavy);

    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = performance.now();
      const { light, heavy } = splitPersistedState(state);
      const lightJson = JSON.stringify(light);
      const heavyJson = JSON.stringify(heavy);
      utf8ByteLength(lightJson);
      const heavyBytes = utf8ByteLength(heavyJson);
      const elapsed = performance.now() - t0;
      samples.push(elapsed);
      expect(heavyBytes).toBeGreaterThan(0);
    }
    const best = Math.min(...samples);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const t1 = performance.now();
    await storage.setItem("lwb-mobile-store", value);
    const writeMs = performance.now() - t1;
    // eslint-disable-next-line no-console
    console.log(
      `[persist perf] 1000 sessions：序列化+拆分 best=${best.toFixed(3)}ms avg=${avg.toFixed(3)}ms；setItem(含 mock 内存写)=${writeMs.toFixed(3)}ms；heavy=${(utf8ByteLength(JSON.stringify(splitPersistedState(state).heavy)) / 1024).toFixed(1)}KB`
    );
    expect(best).toBeLessThan(5);
  });
});
