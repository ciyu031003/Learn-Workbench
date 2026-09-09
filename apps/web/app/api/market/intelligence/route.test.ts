import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/domains/market/intelligence", () => ({
  queryMarketIntelligence: vi.fn(async () => ({ total: 12 })),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { queryMarketIntelligence } from "@/lib/domains/market/intelligence";
import { GET } from "./route";

const queryMock = vi.mocked(queryMarketIntelligence);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/market/intelligence", () => {
  it("parses filters from the query string", async () => {
    queryMock.mockResolvedValue({ total: 12 } as never);
    const response = await GET(
      new Request(
        "http://localhost/api/market/intelligence?city=%E6%B7%B1%E5%9C%B3&function=%E5%90%8E%E7%AB%AF&range=30&salaryMin=15"
      )
    );
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        city: "深圳",
        functionKey: "后端",
        range: 30,
        salaryMin: 15,
      })
    );
  });
});
