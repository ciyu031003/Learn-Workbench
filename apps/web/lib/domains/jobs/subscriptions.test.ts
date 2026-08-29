import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import {
  listSubscriptions, saveSubscription, deleteSubscription, listNotifications,
  unreadNotificationCount, markNotificationRead, markAllNotificationsRead,
} from "./subscriptions";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("listSubscriptions", () => {
  it("maps rows and normalizes arrays", async () => {
    queryMock.mockResolvedValue({
      rows: [{ id: 1, name: "后端", categories: ["internet"], keywords: ["Go"], cities: ["上海"], enabled: true, created_at: "2026-08-01T00:00:00Z" }],
    } as never);
    const subs = await listSubscriptions("u-1");
    expect(subs[0].id).toBe(1);
    expect(subs[0].categories).toEqual(["internet"]);
    expect(subs[0].keywords).toEqual(["Go"]);
    expect(subs[0].enabled).toBe(true);
    expect(subs[0].createdAt).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("saveSubscription", () => {
  it("defaults name and serializes arrays when no id", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 3, name: "我的订阅", categories: [], keywords: [], cities: [], enabled: false, created_at: "2026-08-01T00:00:00Z" }] } as never);
    const sub = await saveSubscription("u-1", { name: "我的订阅", categories: [], keywords: [], cities: [], enabled: false });
    expect(queryMock.mock.calls[0][1]).toEqual([null, "u-1", "我的订阅", "[]", "[]", "[]", false]);
    expect(sub.id).toBe(3);
  });

  it("keeps provided id and trimmed name", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 9, name: "AI", categories: ["internet"], keywords: ["ML"], cities: ["北京"], enabled: true, created_at: "2026-08-01T00:00:00Z" }] } as never);
    await saveSubscription("u-1", { id: 9, name: "  AI  ", categories: ["internet"], keywords: ["ML"], cities: ["北京"], enabled: true });
    expect(queryMock.mock.calls[0][1]).toEqual([9, "u-1", "AI", '["internet"]', '["ML"]', '["北京"]', true]);
  });
});

describe("deleteSubscription", () => {
  it("returns true when rowCount > 0", async () => {
    queryMock.mockResolvedValue({ rowCount: 1 } as never);
    expect(await deleteSubscription("u-1", 5)).toBe(true);
  });

  it("returns false when rowCount is 0", async () => {
    queryMock.mockResolvedValue({ rowCount: 0 } as never);
    expect(await deleteSubscription("u-1", 5)).toBe(false);
  });
});

describe("listNotifications", () => {
  it("builds unread filter when unreadOnly", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await listNotifications("u-1", true, 5);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("read_at IS NULL");
    expect(args).toEqual(["u-1", 5]);
  });

  it("maps rows to JobNotification shape", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1, job_id: 2, subscription_id: 3, title: "t", body: null, url: null, read_at: null, created_at: "2026-08-01T00:00:00Z" }] } as never);
    const rows = await listNotifications("u-1");
    expect(rows[0].subscriptionId).toBe(3);
    expect(rows[0].read).toBe(false);
    expect(rows[0].body).toBe("");
  });
});

describe("unreadNotificationCount", () => {
  it("returns count", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 4 }] } as never);
    expect(await unreadNotificationCount("u-1")).toBe(4);
  });
});

describe("markNotificationRead / markAll", () => {
  it("marks a single notification read", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await markNotificationRead("u-1", 7);
    expect(queryMock.mock.calls[0][1]).toEqual([7, "u-1"]);
  });

  it("marks all read", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await markAllNotificationsRead("u-1");
    expect(String(queryMock.mock.calls[0][0])).toContain("SET read_at = now()");
  });
});

