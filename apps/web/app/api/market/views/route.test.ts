import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/domains/market/saved-views", () => ({
  listMarketSavedViews: vi.fn(),
  createMarketSavedView: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { currentUserId } from "@/lib/session";
import { createMarketSavedView, listMarketSavedViews } from "@/lib/domains/market/saved-views";
import { GET, POST } from "./route";

const userIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listMarketSavedViews);
const createMock = vi.mocked(createMarketSavedView);

beforeEach(() => vi.clearAllMocks());

describe("market saved views collection routes", () => {
  it("returns 401 for anonymous GET", async () => {
    userIdMock.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("lists saved views", async () => {
    userIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith("u-1");
  });

  it("creates a saved view", async () => {
    userIdMock.mockResolvedValue("u-1");
    createMock.mockResolvedValue({
      id: 3,
      name: "深圳后端",
      filters: { city: "深圳", functionKey: "后端" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const response = await POST(
      new Request("http://localhost/api/market/views", {
        method: "POST",
        body: JSON.stringify({ name: "深圳后端", filters: { city: "深圳", functionKey: "后端" } }),
      })
    );
    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith("u-1", "深圳后端", expect.objectContaining({ city: "深圳" }));
  });
});
