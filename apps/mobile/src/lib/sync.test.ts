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
    setLastSyncedAt: vi.fn(),
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

describe("syncPull（S5-3 设备时钟跑偏不影响游标）", () => {
  it("applies remote changes and stores serverTime", async () => {
    const state = mockState({ lastSyncedAt: "2026-08-13T09:00:00.000Z", applyRemoteChanges: vi.fn() });
    const changes = [change("1")];
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes, serverTime: "2026-08-13T10:00:00.000Z" }),
    } as never);
    await syncPull("tok");
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("/api/sync/pull?deviceId=dev-1");
    expect(url).toContain(`since=${encodeURIComponent("2026-08-13T09:00:00.000Z")}`);
    expect(state.applyRemoteChanges).toHaveBeenCalledWith(changes);
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-13T10:00:00.000Z");
  });

  it("设备时钟 +1h：仍按上次服务端时间拉取，不会把 since 推到未来", async () => {
    // 设备时间被调到未来 1 小时（真实场景：用户手动改时间/时区错误）
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T10:00:00.000Z"));
    const state = mockState({ lastSyncedAt: "2026-08-13T09:00:00.000Z", applyRemoteChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes: [], serverTime: "2026-08-14T09:10:00.000Z" }),
    } as never);

    await syncPull("tok");

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    // since 仍是上次服务端游标（旧变更能被拉到），不是本机 now
    expect(url).toContain(`since=${encodeURIComponent("2026-08-13T09:00:00.000Z")}`);
    expect(url).not.toContain("2026-08-14T10");
    // 新游标也取服务端时间
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-14T09:10:00.000Z");
    // 时钟偏移被记录（手机比服务器快约 50 分钟），>5min 触发提示
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
