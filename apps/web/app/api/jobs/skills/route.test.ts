import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const errorMock = vi.mocked(logger.error);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/jobs/skills", () => {
  it("returns skills", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1, name: "Go", category: "language", aliases: ["golang"] }] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).skills).toEqual([{ id: 1, name: "Go", category: "language", aliases: ["golang"] }]);
  });

  it("returns 500 on error", async () => {
    queryMock.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
