import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { SPORT_CATALOG } from "@learn-workbench/shared";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/sports", () => {
  it("returns catalog from database", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { key: "basketball", name: "篮球", type: "BALL", met: "6.5", default_minutes: 30, featured: true },
        { key: "run", name: "跑步", type: "AEROBIC", met: "8.0", default_minutes: 30, featured: true },
      ],
    } as never);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toEqual({ key: "basketball", name: "篮球", type: "BALL", met: 6.5, defaultMinutes: 30, featured: true });
  });

  it("falls back to bundled catalog when table is empty", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.items).toEqual(SPORT_CATALOG);
  });

  it("falls back to bundled catalog when database is down", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(30);
    expect(body.items.some((i: { key: string }) => i.key === "baduanjin")).toBe(true);
    expect(body.items.some((i: { key: string }) => i.key === "tai-chi")).toBe(true);
    expect(body.items.some((i: { key: string }) => i.key === "frisbee")).toBe(true);
  });
});
