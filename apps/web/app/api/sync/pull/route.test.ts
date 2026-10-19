import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/sync-service", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod, // sanitizeDeviceId / sanitizeDeviceName / serverTimeISO 走真实实现
    collectChangesSince: vi.fn(),
    upsertSyncDevice: vi.fn(),
  };
});

import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { collectChangesSince, upsertSyncDevice } from "@/lib/sync-service";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const connectMock = vi.mocked(pgPool.connect);
const collectMock = vi.mocked(collectChangesSince);
const upsertMock = vi.mocked(upsertSyncDevice);

const AT = "2026-08-13T10:00:00.000Z";

function makeClient(now: Date | string = new Date(AT)) {
  const query = vi.fn().mockResolvedValue({ rows: [{ now }] });
  const release = vi.fn();
  connectMock.mockResolvedValue({ query, release } as never);
  return { query, release };
}

function change(entityType: string, entityId: string, payload: Record<string, unknown> | null = null) {
  return {
    entityType,
    entityId,
    operation: payload ? "UPDATE" : "DELETE",
    version: 1,
    payload,
    updatedAt: AT,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  collectMock.mockResolvedValue([] as never);
  upsertMock.mockResolvedValue(undefined);
});

describe("GET /api/sync/pull (v2)", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/sync/pull"));
    expect(res.status).toBe(401);
  });

  it("returns collected changes, Shanghai serverTime and records the device", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    const item = change("progress", "1", { done: true, note: null });
    collectMock.mockResolvedValue([item] as never);

    const res = await GET(
      new Request("http://localhost/api/sync/pull?deviceId=dev-1&deviceName=mobile&since=2026-08-13T09%3A00%3A00.000Z")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.changes).toEqual([item]);
    // serverTime 统一 Asia/Shanghai ISO（+08:00）
    expect(json.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/);
    expect(json.hasMore).toBe(false);
    expect(json.cursor).toBeNull();
    expect(collectMock).toHaveBeenCalledWith(expect.anything(), "u-1", new Date("2026-08-13T09:00:00.000Z"), {
      entities: undefined,
    });
    expect(upsertMock).toHaveBeenCalledWith(expect.anything(), "u-1", "dev-1", "mobile");
  });

  it("filters by entities whitelist (order follows SYNC_ENTITY_TYPES)", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    collectMock.mockResolvedValue([] as never);
    await GET(new Request("http://localhost/api/sync/pull?entities=logs,tasks"));
    expect(collectMock).toHaveBeenCalledWith(expect.anything(), "u-1", new Date(0), {
      entities: ["tasks", "logs"],
    });
  });

  it("returns 400 with the allowed list for an unknown entity", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    const res = await GET(new Request("http://localhost/api/sync/pull?entities=tasks,notAThing"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("validation_failed");
    expect(json.error).toContain("notAThing");
    expect(json.allowed).toContain("tasks");
    expect(collectMock).not.toHaveBeenCalled();
  });

  it("limits the page and returns a cursor when more remain", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    collectMock.mockResolvedValue([
      change("progress", "1", { done: true, note: null }),
      change("progress", "2", { done: false, note: null }),
      change("progress", "3", { done: true, note: null }),
    ] as never);

    const res = await GET(new Request("http://localhost/api/sync/pull?since=2026-08-13T09:00:00.000Z&limit=2"));
    const json = await res.json();
    expect(json.changes).toHaveLength(2);
    expect(json.hasMore).toBe(true);
    expect(typeof json.cursor).toBe("string");

    // 第二页：保持 since 不变、带 cursor（偏移 2）
    const res2 = await GET(
      new Request(
        `http://localhost/api/sync/pull?since=2026-08-13T09:00:00.000Z&limit=2&cursor=${encodeURIComponent(json.cursor)}`
      )
    );
    const json2 = await res2.json();
    expect(json2.changes).toHaveLength(1);
    expect(json2.changes[0].entityId).toBe("3");
    expect(json2.hasMore).toBe(false);
    expect(json2.cursor).toBeNull();
    // 两页拼起来 == 全量，且不重复
    const ids = [...json.changes, ...json2.changes].map((c: { entityId: string }) => c.entityId);
    expect(ids).toEqual(["1", "2", "3"]);
  });

  it("rejects a malformed limit with 400", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    const res = await GET(new Request("http://localhost/api/sync/pull?limit=0"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("validation_failed");
  });

  it("rejects a malformed cursor with 400 (never silently restarts from page 1)", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    const res = await GET(new Request("http://localhost/api/sync/pull?cursor=not-base64-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("cursor");
  });

  it("falls back to epoch when since is invalid", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    await GET(new Request("http://localhost/api/sync/pull?since=not-a-date"));
    expect(collectMock).toHaveBeenCalledWith(expect.anything(), "u-1", new Date(0), { entities: undefined });
  });

  it("sanitizes a malformed deviceId before upserting the device", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    await GET(new Request("http://localhost/api/sync/pull?deviceId=bad%20id!!"));
    expect(upsertMock).toHaveBeenCalledWith(expect.anything(), "u-1", "unknown", null);
  });

  it("truncates an over-long deviceName to 50 chars", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    makeClient();
    const longName = "x".repeat(80);
    await GET(new Request(`http://localhost/api/sync/pull?deviceId=dev-1&deviceName=${longName}`));
    expect(upsertMock).toHaveBeenCalledWith(expect.anything(), "u-1", "dev-1", "x".repeat(50));
  });
});
