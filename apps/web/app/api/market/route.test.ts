import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/market", () => ({ analyzeMarket: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { analyzeMarket } from "@/lib/market";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const analyzeMock = vi.mocked(analyzeMarket);
const loggerMock = vi.mocked(logger.error);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/market", () => {
  it("returns 200 with the market analysis payload", async () => {
    analyzeMock.mockResolvedValue({ total: 42 } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 42 });
    expect(analyzeMock).toHaveBeenCalled();
  });

  it("returns 500 and logs when analysis throws", async () => {
    analyzeMock.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "市场分析加载失败" });
    expect(loggerMock).toHaveBeenCalledWith("market api error", expect.any(Error));
  });
});
