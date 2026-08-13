import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/sync-service", () => ({
  collectChangesSince: vi.fn(),
  upsertSyncDevice: vi.fn(),
}));

import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { collectChangesSince, upsertSyncDevice } from "@/lib/sync-service";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const connectMock = vi.mocked(pgPool.connect);
const collectMock = vi.mocked(collectChangesSince);
const upsertMock = vi.mocked(upsertSyncDevice);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/sync/pull", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/sync/pull"));
    expect(res.status).toBe(401);
  });

  it("returns collected changes and records the device", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const query = vi.fn().mockResolvedValue({ rows: [{ now: "2026-08-13T10:00:00.000Z" }] });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const change = { entityType: "progress", entityId: "1", operation: "UPDATE", version: 1, payload: { done: true }, updatedAt: "2026-08-13T10:00:00.000Z" };
    collectMock.mockResolvedValue([change] as never);

    const url = "http://localhost/api/sync/pull?deviceId=dev-1&deviceName=mobile&since=2026-08-13T09%3A00%3A00.000Z";
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.changes).toEqual([change]);
    expect(json.serverTime).toBe("2026-08-13T10:00:00.000Z");
    expect(collectMock).toHaveBeenCalledWith(expect.anything(), "u-1", new Date("2026-08-13T09:00:00.000Z"));
    expect(upsertMock).toHaveBeenCalledWith(expect.anything(), "u-1", "dev-1", "mobile");
    expect(release).toHaveBeenCalled();
  });

  it("falls back to epoch when since is invalid", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    connectMock.mockResolvedValue({ query: vi.fn().mockResolvedValue({ rows: [{ now: "x" }] }), release: vi.fn() } as never);
    collectMock.mockResolvedValue([] as never);
    await GET(new Request("http://localhost/api/sync/pull?since=not-a-date"));
    expect(collectMock).toHaveBeenCalledWith(expect.anything(), "u-1", new Date(0));
  });
});
