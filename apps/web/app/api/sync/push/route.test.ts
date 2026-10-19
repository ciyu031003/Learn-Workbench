import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/sync-service", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod, // sanitizeDeviceId / sanitizeDeviceName / serverTimeISO 走真实实现
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

const AT = "2026-08-13T10:00:00.000Z";

function makeClient() {
  const query = vi.fn().mockResolvedValue({ rows: [{ now: new Date(AT) }] });
  const release = vi.fn();
  connectMock.mockResolvedValue({ query, release } as never);
  return { query, release };
}

function pushRequest(body: unknown) {
  return new Request("http://localhost/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function progressChange(overrides: Record<string, unknown> = {}) {
  return {
    entityType: "progress",
    entityId: "1",
    operation: "UPDATE" as const,
    version: 1,
    payload: { done: true, note: null },
    updatedAt: AT,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pgPool.query).mockResolvedValue({ rows: [] } as never);
  recordSyncChangesMock.mockResolvedValue([]);
  upsertSyncDeviceMock.mockResolvedValue(undefined);
});

describe("POST /api/sync/push (v2)", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/sync/push", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "请先登录", code: "unauthorized" });
  });

  it("returns 400 when the body is not valid JSON", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(
      new Request("http://localhost/api/sync/push", { method: "POST", body: "not-json" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "JSON 解析失败", code: "validation_failed" });
  });

  it("applies changes, records only applied ones and upserts the device in a transaction", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const { query, release } = makeClient();
    const body = {
      deviceId: "dev-1",
      deviceName: "手机",
      changes: [progressChange()],
    };
    applyChangesMock.mockResolvedValue({
      applied: 2,
      okChanges: [progressChange() as never],
      receipts: [
        { changeId: null, index: 0, result: "applied", reason: "applied", seq: null, recordIndex: 0 },
      ],
    });
    recordSyncChangesMock.mockResolvedValue([17]);

    const res = await POST(pushRequest(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, applied: 2 });
    expect(json.receipts).toEqual([
      { changeId: null, index: 0, result: "applied", reason: "applied", seq: 17 },
    ]);
    // serverTime 统一为 Asia/Shanghai ISO（+08:00），客户端唯一可信游标
    expect(json.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/);
    expect(query).toHaveBeenCalledWith("BEGIN");
    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(applyChangesMock).toHaveBeenCalledWith(expect.anything(), "u-1", [
      expect.objectContaining({ entityType: "progress", entityId: "1", changeId: undefined }),
    ]);
    // 只记录成功应用的变更（失败变更记入幂等表会导致重试被跳过 → 静默丢数据）
    expect(recordSyncChangesMock).toHaveBeenCalledWith(expect.anything(), "u-1", "dev-1", [
      expect.objectContaining({ entityType: "progress", entityId: "1" }),
    ]);
    expect(upsertSyncDeviceMock).toHaveBeenCalledWith(expect.anything(), "u-1", "dev-1", "手机");
    expect(release).toHaveBeenCalled();
  });

  it("returns 400 with the failing index when updatedAt is not a zoned ISO timestamp", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    const res = await POST(
      pushRequest({
        deviceId: "dev-1",
        changes: [
          progressChange({ changeId: "ok-1" }),
          progressChange({ changeId: "bad-1", updatedAt: "2026-08-13 10:00:00" }),
        ],
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("validation_failed");
    expect(json.index).toBe(1);
    expect(json.error).toContain("第 2 条");
    expect(json.error).toContain("updatedAt");
    expect(applyChangesMock).not.toHaveBeenCalled();
  });

  it("returns receipts for applied / stale(duplicate) / rejected(unknown entity) in one batch", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    applyChangesMock.mockResolvedValue({
      applied: 1,
      okChanges: [progressChange({ changeId: "c-applied" }) as never],
      receipts: [
        { changeId: "c-applied", index: 0, result: "applied", reason: "applied", seq: null, recordIndex: 0 },
        { changeId: "c-retry", index: 1, result: "stale", reason: "duplicate", seq: 9, recordIndex: null },
        { changeId: "c-unknown", index: 2, result: "rejected", reason: "unknown_entity_type", seq: null, recordIndex: null },
      ],
    });
    recordSyncChangesMock.mockResolvedValue([21]);

    const res = await POST(
      pushRequest({
        deviceId: "dev-1",
        changes: [
          progressChange({ changeId: "c-applied" }),
          progressChange({ changeId: "c-retry" }),
          // 未知实体：不整批 400，按条 rejected；占位项要与请求等长（index 对齐）
          { entityType: "futureEntity", entityId: "x", operation: "CREATE", payload: null, updatedAt: AT, changeId: "c-unknown" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.applied).toBe(1);
    expect(json.receipts).toEqual([
      { changeId: "c-applied", index: 0, result: "applied", reason: "applied", seq: 21 },
      { changeId: "c-retry", index: 1, result: "stale", reason: "duplicate", seq: 9 },
      { changeId: "c-unknown", index: 2, result: "rejected", reason: "unknown_entity_type", seq: null },
    ]);
    // 未知实体只回执、不写幂等表（recordSyncChanges 只拿 okChanges）
    expect(recordSyncChangesMock.mock.calls[0][3]).toHaveLength(1);
  });

  it("rejects batches exceeding the per-push change limit with 413", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const changes = Array.from({ length: 501 }, (_, i) => progressChange({ entityId: String(i), changeId: `c-${i}` }));
    const res = await POST(pushRequest({ deviceId: "dev-1", changes }));
    expect(res.status).toBe(413);
    expect(applyChangesMock).not.toHaveBeenCalled();
  });

  it("falls back to a sanitized device id when deviceId is malformed", async () => {
    currentUserIdMock.mockResolvedValue("u-abcdef12");
    applyChangesMock.mockResolvedValue({ applied: 0, okChanges: [], receipts: [] });
    makeClient();
    const res = await POST(pushRequest({ deviceId: "bad device id!!", changes: [] }));
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
    const res = await POST(pushRequest({ deviceId: "dev-1", changes: [] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "同步失败", code: "internal_error" });
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    errSpy.mockRestore();
  });
});
