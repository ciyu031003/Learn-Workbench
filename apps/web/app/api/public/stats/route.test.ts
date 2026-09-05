import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/public/stats", () => {
  it("returns aggregate stats without auth", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          total: 3279,
          today_new: 334,
          city_count: 47,
          platform_count: 19,
          avg_salary: 14,
          fetched_at: "2026-09-05T00:40:28Z",
        },
      ],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3279);
    expect(body.todayNew).toBe(334);
    expect(body.cityCount).toBe(47);
    expect(body.platformCount).toBe(19);
    expect(body.avgSalary).toBe(14);
    expect(body.fetchedAt).toBe("2026-09-05T00:40:28.000Z");
  });

  it("returns 503 when the database is unavailable", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
