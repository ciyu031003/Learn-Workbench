import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/sync-service", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod, // sanitizeDeviceId / sanitizeDeviceName 走真实实现
    applyChanges: vi.fn(),
    recordSyncChanges: vi.fn(),
    upsertSyncDevice: vi.fn(),
  };
});

import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { applyChanges, recordSyncChanges, upsertSyncDevice } from "@/lib/sync-service";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const connectMock = vi.mocked(pgPool.connect);
const applyChangesMock = vi.mocked(applyChanges);
const recordSyncChangesMock = vi.mocked(recordSyncChanges);
const upsertSyncDeviceMock = vi.mocked(upsertSyncDevice);

function makeClient() {
  const query = vi.fn().mockResolvedValue({ rows: [{ now: "2026-08-13T10:00:00.000Z" }] });
  const release = vi.fn();
  connectMock.mockResolvedValue({ query, release } as never);
  return { query, release };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pgPool.query).mockResolvedValue({ rows: [] } as never);
});

describe("POST /api/sync/push", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/sync/push", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "请先登录" });
  });

  it("returns 400 when the body is not valid JSON", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(
      new Request("http://localhost/api/sync/push", { method: "POST", body: "not-json" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "JSON 解析失败" });
  });

  it("applies changes, records only applied ones and upserts the device in a transaction", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const { query, release } = makeClient();
    const body = {
      deviceId: "dev-1",
      deviceName: "手机",
      changes: [
        { entityType: "progress", entityId: "1", operation: "UPDATE" as const, version: 1, payload: { done: true }, updatedAt: "2026-08-13T10:00:00.000Z" },
      ],
    };
    applyChangesMock.mockResolvedValue({ applied: 2, okChanges: body.changes });
    const res = await POST(
      new Request("http://localhost/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, applied: 2, serverTime: "2026-08-13T10:00:00.000Z" });
    expect(query).toHaveBeenCalledWith("BEGIN");
    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(applyChangesMock).toHaveBeenCalledWith(expect.anything(), "u-1", body.changes);
    // 只记录成功应用的变更（失败变更记入幂等表会导致重试被跳过 → 静默丢数据）
    expect(recordSyncChangesMock).toHaveBeenCalledWith(expect.anything(), "u-1", "dev-1", body.changes);
    expect(upsertSyncDeviceMock).toHaveBeenCalledWith(expect.anything(), "u-1", "dev-1", "手机");
    expect(release).toHaveBeenCalled();
  });

  it("rejects batches exceeding the per-push change limit with 413", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const changes = Array.from({ length: 501 }, (_, i) => ({
      entityType: "progress", entityId: String(i), operation: "UPDATE", version: 1,
      payload: { done: false }, updatedAt: "2026-08-13T10:00:00.000Z",
    }));
    const res = await POST(
      new Request("http://localhost/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: "dev-1", changes }),
      })
    );
    expect(res.status).toBe(413);
    expect(applyChangesMock).not.toHaveBeenCalled();
  });

  it("falls back to a sanitized device id when deviceId is malformed", async () => {
    currentUserIdMock.mockResolvedValue("u-abcdef12");
    applyChangesMock.mockResolvedValue({ applied: 0, okChanges: [] });
    makeClient();
    const res = await POST(
      new Request("http://localhost/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: "bad device id!!", changes: [] }),
      })
    );
    expect(res.status).toBe(200);
    // 回退 id = "anon-" + uid 前 8 位
    expect(upsertSyncDeviceMock).toHaveBeenCalledWith(
      expect.anything(), "u-abcdef12", "anon-u-abcdef", null
    );
  });

  it("rolls back and returns 500 when applying changes fails", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    applyChangesMock.mockRejectedValue(new Error("db down"));
    const { query } = makeClient();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      new Request("http://localhost/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: "dev-1", changes: [] }),
      })
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "同步失败" });
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    errSpy.mockRestore();
  });
});
