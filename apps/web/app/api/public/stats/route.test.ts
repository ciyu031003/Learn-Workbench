import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

const SNAPSHOT = {
  total: 3279,
  todayNew: 334,
  cityCount: 47,
  platformCount: 19,
  avgSalary: 14,
  fetchedAt: "2026-09-05T00:40:28.000Z",
};

describe("GET /api/public/stats", () => {
  it("serves the pre-aggregated snapshot (single-row read) with cache headers", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ payload: SNAPSHOT, computed_at: new Date() }],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3279);
    expect(body.todayNew).toBe(334);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=600");
    // 只有一次单行查询，未触发全表聚合
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(String(queryMock.mock.calls[0][0])).toContain("FROM market_stats");
  });

  it("recomputes and backfills when the snapshot is stale", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never) // 快照缺失
      .mockResolvedValueOnce({
        rows: [
          {
            total: 100,
            today_new: 5,
            city_count: 3,
            platform_count: 2,
            avg_salary: 12,
            fetched_at: "2026-09-05T00:40:28Z",
          },
        ],
      } as never); // 实时聚合
    const res = await GET();
    const body = await res.json();
    expect(body.total).toBe(100);
    // 回填快照缓存
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO market_stats"),
      ["public", expect.any(String)]
    );
  });

  it("returns 503 when the database is unavailable", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
