import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  currentSessionToken: vi.fn(async () => "token-1"),
  currentUserId: vi.fn(async () => "u-1"),
}));
vi.mock("@/lib/domains/market/personal", () => ({
  getMarketPersonalInsights: vi.fn(async () => ({ loggedIn: true, reachableJobs: 8 })),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { currentSessionToken, currentUserId } from "@/lib/session";
import { getMarketPersonalInsights } from "@/lib/domains/market/personal";
import { GET } from "./route";

const userIdMock = vi.mocked(currentUserId);
const tokenMock = vi.mocked(currentSessionToken);
const insightsMock = vi.mocked(getMarketPersonalInsights);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/market/personal", () => {
  it("returns personal insights for a logged-in user", async () => {
    insightsMock.mockResolvedValue({ loggedIn: true, reachableJobs: 8 } as never);
    const response = await GET(new Request("http://localhost/api/market/personal?limit=3"));
    expect(response.status).toBe(200);
    expect(insightsMock).toHaveBeenCalledWith("u-1", 3);
  });

  it("returns an anonymous state without logging in", async () => {
    tokenMock.mockResolvedValueOnce(null);
    userIdMock.mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/api/market/personal"));
    expect(await response.json()).toEqual({ loggedIn: false });
    expect(insightsMock).not.toHaveBeenCalled();
  });
});
