import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/config", () => ({ API_URL: "https://example.com" }));
vi.mock("@/store/app-store", () => ({
  useAppStore: {
    getState: vi.fn(),
  },
}));

import { apiLogin, syncPush, syncPull } from "./sync";
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
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

describe("syncPush", () => {
  it("only bumps lastSyncedAt when there are no pending changes", async () => {
    const state = mockState({ pendingChanges: [], setLastSyncedAt: vi.fn() });
    await syncPush("tok");
    expect(fetch).not.toHaveBeenCalled();
    expect(state.setLastSyncedAt).toHaveBeenCalledWith(expect.any(String));
  });

  it("POSTs pending changes and clears them on success", async () => {
    const changes = [{ entityType: "progress", entityId: "1", operation: "UPDATE", version: 1, payload: {}, updatedAt: "2026-08-13T10:00:00.000Z" }];
    const state = mockState({ pendingChanges: changes, clearPendingChanges: vi.fn() });
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
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-13T11:00:00.000Z");
  });

  it("throws when the push fails", async () => {
    mockState({ pendingChanges: [{ entityType: "progress", entityId: "1", operation: "UPDATE", version: 1, payload: {}, updatedAt: "2026-08-13T10:00:00.000Z" }] });
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "同步失败" }),
    } as never);
    await expect(syncPush("tok")).rejects.toThrow("同步失败");
  });
});

describe("syncPull", () => {
  it("applies remote changes and stores serverTime", async () => {
    const state = mockState({ lastSyncedAt: "2026-08-13T09:00:00.000Z", applyRemoteChanges: vi.fn() });
    const changes = [{ entityType: "progress", entityId: "1", operation: "UPDATE", version: 1, payload: { done: true }, updatedAt: "2026-08-13T10:00:00.000Z" }];
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes, serverTime: "2026-08-13T10:00:00.000Z" }),
    } as never);
    await syncPull("tok");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sync/pull?deviceId=dev-1"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok" }) })
    );
    expect(state.applyRemoteChanges).toHaveBeenCalledWith(changes);
    expect(state.setLastSyncedAt).toHaveBeenCalledWith("2026-08-13T10:00:00.000Z");
  });

  it("does not apply when there are no changes", async () => {
    const state = mockState({ applyRemoteChanges: vi.fn() });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ changes: [], serverTime: null }),
    } as never);
    await syncPull("tok");
    expect(state.applyRemoteChanges).not.toHaveBeenCalled();
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
