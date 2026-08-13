import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/careers", () => {
  it("returns the ordered career list", async () => {
    queryMock.mockResolvedValue({
      rows: [{ career_key: "ict", name: "ICT", description: null, is_locked: true, sort_order: 0 }],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      careers: [{ career_key: "ict", name: "ICT", description: null, is_locked: true, sort_order: 0 }],
    });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY sort_order, id"));
  });
});
