import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/jobs/stats", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("aggregates stats", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [{ total: 10, today_new: 2, platform_count: 3, last_run: "2026-08-01T00:00:00Z", last_run_status: "success" }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ category: "internet", n: 7 }, { category: "official", n: 3 }] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(10);
    expect(body.todayNew).toBe(2);
    expect(body.platformCount).toBe(3);
    expect(body.byCategory).toEqual({ internet: 7, official: 3 });
    expect(body.lastRunStatus).toBe("success");
  });
});
