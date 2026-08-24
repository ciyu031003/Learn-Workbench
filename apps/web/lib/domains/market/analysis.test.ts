import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { invalidateMarketCache } from "./analysis";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("invalidateMarketCache", () => {
  it("deletes the market_stats cache row", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await invalidateMarketCache();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM market_stats WHERE key = $1"),
      ["full"]
    );
  });

  it("does not throw when db fails", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    await expect(invalidateMarketCache()).resolves.toBeUndefined();
  });
});
