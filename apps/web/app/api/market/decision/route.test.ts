import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/domains/market/decision", () => ({
  getMarketDecision: vi.fn(async () => ({ generatedAt: "", hotspots: [], migrations: [], alerts: [], scenario: {} })),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { currentSessionToken, currentUserId } from "@/lib/session";
import { getMarketDecision } from "@/lib/domains/market/decision";
import { GET } from "./route";

const userIdMock = vi.mocked(currentUserId);
const tokenMock = vi.mocked(currentSessionToken);
const decisionMock = vi.mocked(getMarketDecision);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/market/decision", () => {
  it("passes target filters and user id", async () => {
    tokenMock.mockResolvedValue("token-1");
    userIdMock.mockResolvedValue("u-1");
    const response = await GET(
      new Request("http://localhost/api/market/decision?city=%E6%B7%B1%E5%9C%B3&function=%E5%90%8E%E7%AB%AF")
    );
    expect(response.status).toBe(200);
    expect(decisionMock).toHaveBeenCalledWith("u-1", { city: "深圳", functionKey: "后端" });
  });
});
