import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/config", () => ({ DEFAULT_API_URL: "https://example.com", getApiUrl: () => "https://example.com" }));
vi.mock("@/store/app-store", () => ({
  useAppStore: {
    getState: vi.fn(),
  },
}));

import { apiLogin, isValidServerTime, syncPush, syncPull } from "./sync";
import { __resetServerClockForTests, getServerClockOffsetMs, isClockSkewed } from "./sync-clock";
import { useAppStore } from "@/store/app-store";

const getStateMock = vi.mocked(useAppStore.getState);

function mockState(overrides: Record<string, unknown>) {
  const state = {
    pendingChanges: [],
    deviceId: "dev-1",
    lastSyncedAt: null,
    lastSyncedSeq: null,
    setLastSyncedAt: vi.fn(),
    setLastSyncedSeq: vi.fn(),
    clearPendingChanges: vi.fn(),
    applyRemoteChanges: vi.fn(),
    ...overrides,
  };
  getStateMock.mockReturnValue(state as never);
  return state;
}

const change = (entityId: string) => ({
  entityType: "progress",
  entityId,
  operation: "UPDATE",
  version: 1,
  payload: {},
  updatedAt: "2026-08-13T10:00:00.000Z",
});

const receipt = (index: number, result: string, reason = "applied", changeId: string | null = null) => ({
  changeId,
  index,
  result,
  reason,
  seq: result === "rejected" ? null : index + 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  __resetServerClockForTests();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiLogin", () => {
  it("returns token and user on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ token: "tok", user: { username: "alice" } }),
    } as never);
    const data = await apiLogin("alice", "pw");
    expect(data).toEqual({ token: "tok", user: { username: "alice" } });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api/auth/login",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws the server error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "账号或密码错误" }),
    } as never);
    await expect(apiLogin("alice", "bad")).rejects.toThrow("账号或密码错误");
  });
});

describe("syncPush（S5-3 游标只认 serverTime）", () => {
  it("空队列：不发请求，也绝不推进游标", async () => {
    const state = mockState({ pendingChanges: [], setLastSyncedAt: vi.fn() });
    await syncPush("tok");
    expect(fetch).not.toHaveBeenCalled();
    expect(state.setLastSyncedAt).not.toHaveBeenCalled();
  });

  it("POSTs pending changes and advances the cursor from serverTime only", async () => {
    const state = mockState({ pendingChanges: [change("1")], clearPendingChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ serverTime: "2026-08-13T11:00:00.000Z" }),
    } as never);
    await syncPush("tok");
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api/sync/push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
        body: expect.stringContaining("dev-1"),
      })
    );
    // 无回执（老服务端）→ 保守整批清出（旧行为）
    expect(state.clearPendingChanges).toHaveBeenCalled();
    expect(state.setLastSyncedAt).toHaveBeenCalledTimes(1);
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-13T11:00:00.000Z");
  });

  it("服务端没给 serverTime（或非法值）时不推进游标", async () => {
    const state = mockState({ pendingChanges: [change("1")] });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ serverTime: "not-a-date" }),
    } as never);
    await syncPush("tok");
    expect(state.setLastSyncedAt).not.toHaveBeenCalled();
  });

  it("throws when the push fails", async () => {
    mockState({ pendingChanges: [change("1")] });
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "同步失败" }),
    } as never);
    await expect(syncPush("tok")).rejects.toThrow("同步失败");
  });
});

describe("syncPush（v2.1 逐条回执处置）", () => {
  it("applied 清出、rejected+apply_failed 保留待重试", async () => {
    const ok = change("1");
    const bad = change("2");
    const state = mockState({ pendingChanges: [ok, bad], clearPendingChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTime: "2026-08-13T11:00:00.000Z",
        receipts: [receipt(0, "applied", "applied", "cid-1"), receipt(1, "rejected", "apply_failed", "cid-2")],
      }),
    } as never);
    await syncPush("tok");
    // 只清 applied 的那条；apply_failed 留在发件箱等下轮重试
    expect(state.clearPendingChanges).toHaveBeenCalledTimes(1);
    expect(state.clearPendingChanges).toHaveBeenCalledWith([ok]);
  });

  it("apply_failed 连续 3 次后丢弃（防毒丸阻塞队列）", async () => {
    const bad = { ...change("1"), changeId: "cid-bad" };
    const state = mockState({ pendingChanges: [bad], clearPendingChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTime: "2026-08-13T11:00:00.000Z",
        receipts: [receipt(0, "rejected", "apply_failed", "cid-bad")],
      }),
    } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await syncPush("tok"); // 第 1 次：保留
      expect(state.clearPendingChanges).not.toHaveBeenCalled();
      await syncPush("tok"); // 第 2 次：保留
      expect(state.clearPendingChanges).not.toHaveBeenCalled();
      await syncPush("tok"); // 第 3 次：达到上限，丢弃
      expect(state.clearPendingChanges).toHaveBeenCalledWith([bad]);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("确定性拒绝（unknown_entity_type）清出 + 告警，不占重试计数", async () => {
    const stale = { ...change("1"), changeId: "cid-x" };
    const state = mockState({ pendingChanges: [stale], clearPendingChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTime: "2026-08-13T11:00:00.000Z",
        receipts: [receipt(0, "rejected", "unknown_entity_type", "cid-x")],
      }),
    } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await syncPush("tok");
      expect(state.clearPendingChanges).toHaveBeenCalledWith([stale]);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("stale（远端已更新/重复）清出", async () => {
    const item = { ...change("1"), changeId: "cid-s" };
    const state = mockState({ pendingChanges: [item], clearPendingChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTime: "2026-08-13T11:00:00.000Z",
        receipts: [receipt(0, "stale", "duplicate", "cid-s")],
      }),
    } as never);
    await syncPush("tok");
    expect(state.clearPendingChanges).toHaveBeenCalledWith([item]);
  });
});

describe("syncPull（v2.1 ledger seq 游标）", () => {
  it("按 sinceSeq 拉取，应用变更并持久化 lastSeq，取完才推进 serverTime", async () => {
    const state = mockState({ lastSyncedSeq: 41, applyRemoteChanges: vi.fn() });
    const changes = [change("1")];
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes, serverTime: "2026-08-13T10:00:00.000Z", hasMore: false, cursor: null, lastSeq: 55, ledgerMinSeq: 3 }),
    } as never);
    await syncPull("tok");
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("/api/sync/pull?deviceId=dev-1");
    expect(url).toContain("sinceSeq=41");
    expect(state.applyRemoteChanges).toHaveBeenCalledWith(changes);
    expect(state.setLastSyncedSeq).toHaveBeenCalledWith(55);
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-13T10:00:00.000Z");
  });

  it("跟随 hasMore/cursor 循环翻页：>500 条不再丢失（评审 P0）", async () => {
    const state = mockState({ lastSyncedSeq: 0, applyRemoteChanges: vi.fn() });
    const page1 = Array.from({ length: 3 }, (_, i) => change(`p1-${i}`));
    const page2 = Array.from({ length: 2 }, (_, i) => change(`p2-${i}`));
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: page1, serverTime: "2026-08-13T10:00:00.000Z", hasMore: true, cursor: "cur-2", lastSeq: 500 }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: page2, serverTime: "2026-08-13T10:01:00.000Z", hasMore: false, cursor: null, lastSeq: 502 }),
      } as never);

    await syncPull("tok");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[0][0] as string).toContain("sinceSeq=0");
    expect(vi.mocked(fetch).mock.calls[1][0] as string).toContain("sinceSeq=500");
    // 两页都被应用，lastSeq 每页推进一次
    expect(state.applyRemoteChanges).toHaveBeenNthCalledWith(1, page1);
    expect(state.applyRemoteChanges).toHaveBeenNthCalledWith(2, page2);
    expect(state.setLastSyncedSeq).toHaveBeenNthCalledWith(1, 500);
    expect(state.setLastSyncedSeq).toHaveBeenNthCalledWith(2, 502);
    // serverTime 只在本轮取完后推进一次（以最后一次响应为准）
    expect(state.setLastSyncedAt).toHaveBeenCalledTimes(1);
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-13T10:01:00.000Z");
  });

  it("ledger 被修剪越游标（ledgerMinSeq > seq+1）→ 重置 0 全量重拉", async () => {
    const state = mockState({ lastSyncedSeq: 100, applyRemoteChanges: vi.fn() });
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [change("fresh")], serverTime: "2026-08-13T10:00:00.000Z", hasMore: false, cursor: null, lastSeq: 300, ledgerMinSeq: 200 }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], serverTime: "2026-08-13T10:01:00.000Z", hasMore: false, cursor: null, lastSeq: 300, ledgerMinSeq: 200 }),
      } as never);

    await syncPull("tok");

    expect((vi.mocked(fetch).mock.calls[0][0] as string)).toContain("sinceSeq=100");
    // 检测到修剪 → 从 0 重拉
    expect((vi.mocked(fetch).mock.calls[1][0] as string)).toContain("sinceSeq=0");
    expect(state.setLastSyncedSeq).toHaveBeenNthCalledWith(1, 0);
    expect(state.setLastSyncedSeq).toHaveBeenNthCalledWith(2, 300);
  });

  it("首拉（lastSyncedSeq=null）从 0 开始，不做修剪重置（ledgerMinSeq 天然 > 1）", async () => {
    const state = mockState({ lastSyncedSeq: null, applyRemoteChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes: [], serverTime: "2026-08-13T10:00:00.000Z", hasMore: false, cursor: null, lastSeq: 9000, ledgerMinSeq: 8000 }),
    } as never);
    await syncPull("tok");
    expect((vi.mocked(fetch).mock.calls[0][0] as string)).toContain("sinceSeq=0");
    expect(fetch).toHaveBeenCalledTimes(1); // 没有因 minSeq>1 陷入重置循环
    expect(state.setLastSyncedSeq).toHaveBeenCalledWith(9000);
  });

  it("设备时钟 +1h 不影响拉取进度（游标是 seq，不是本机时间）", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T10:00:00.000Z"));
    const state = mockState({ lastSyncedSeq: 7, applyRemoteChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes: [], serverTime: "2026-08-14T09:10:00.000Z", hasMore: false, cursor: null, lastSeq: 7, ledgerMinSeq: 1 }),
    } as never);

    await syncPull("tok");

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("sinceSeq=7");
    expect(url).not.toContain("2026-08-14T10");
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-14T09:10:00.000Z");
    expect(getServerClockOffsetMs()).toBeLessThan(0);
    expect(Math.abs(getServerClockOffsetMs())).toBeGreaterThan(5 * 60_000);
    expect(isClockSkewed()).toBe(true);
  });

  it("does not apply when there are no changes", async () => {
    const state = mockState({ applyRemoteChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes: [], serverTime: null }),
    } as never);
    await syncPull("tok");
    expect(state.applyRemoteChanges).not.toHaveBeenCalled();
    expect(state.setLastSyncedAt).not.toHaveBeenCalled();
  });

  it("throws when the pull fails", async () => {
    mockState({});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "拉取失败" }),
    } as never);
    await expect(syncPull("tok")).rejects.toThrow("拉取失败");
  });
});

describe("syncPush batching", () => {
  const bigBatch = (n: number) =>
    Array.from({ length: n }, (_, i) => change(String(i)));

  it("splits queues over 500 changes into batches and clears per batch", async () => {
    const state = mockState({ pendingChanges: bigBatch(1200), clearPendingChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ serverTime: "2026-08-13T11:00:00.000Z" }),
    } as never);
    await syncPush("tok");
    expect(fetch).toHaveBeenCalledTimes(3); // 500 + 500 + 200
    expect(state.clearPendingChanges).toHaveBeenCalledTimes(3);
    const bodies = vi.mocked(fetch).mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string) as { changes: unknown[] }
    );
    expect(bodies[0].changes).toHaveLength(500);
    expect(bodies[1].changes).toHaveLength(500);
    expect(bodies[2].changes).toHaveLength(200);
    expect(state.setLastSyncedAt).toHaveBeenCalledTimes(1);
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-13T11:00:00.000Z");
  });

  it("keeps remaining changes when a later batch fails", async () => {
    const state = mockState({ pendingChanges: bigBatch(501), clearPendingChanges: vi.fn() });
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ serverTime: "2026-08-13T11:00:00.000Z" }) } as never)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "同步失败" }) } as never);
    await expect(syncPush("tok")).rejects.toThrow("同步失败");
    expect(fetch).toHaveBeenCalledTimes(2);
    // 仅第一批被清除；游标不推进（失败批次留待重试）
    expect(state.clearPendingChanges).toHaveBeenCalledTimes(1);
    expect(state.setLastSyncedAt).not.toHaveBeenCalled();
  });
});

describe("isValidServerTime", () => {
  it("only accepts parseable ISO strings", () => {
    expect(isValidServerTime("2026-08-13T10:00:00.000Z")).toBe(true);
    expect(isValidServerTime("")).toBe(false);
    expect(isValidServerTime("not-a-date")).toBe(false);
    expect(isValidServerTime(null)).toBe(false);
    expect(isValidServerTime(123)).toBe(false);
  });
});
