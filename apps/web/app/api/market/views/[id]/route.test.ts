import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/domains/market/saved-views", () => ({
  renameMarketSavedView: vi.fn(),
  updateMarketSavedViewFilters: vi.fn(),
  deleteMarketSavedView: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { currentSessionToken, currentUserId } from "@/lib/session";
import {
  deleteMarketSavedView,
  renameMarketSavedView,
  updateMarketSavedViewFilters,
} from "@/lib/domains/market/saved-views";
import { DELETE, PATCH } from "./route";

const userIdMock = vi.mocked(currentUserId);
const tokenMock = vi.mocked(currentSessionToken);
const renameMock = vi.mocked(renameMarketSavedView);
const updateFiltersMock = vi.mocked(updateMarketSavedViewFilters);
const deleteMock = vi.mocked(deleteMarketSavedView);

beforeEach(() => vi.clearAllMocks());

describe("market saved view item routes", () => {
  it("renames a view", async () => {
    tokenMock.mockResolvedValue("token-1");
    userIdMock.mockResolvedValue("u-1");
    renameMock.mockResolvedValue({ id: 3, name: "重命名", filters: {}, createdAt: "", updatedAt: "" });
    const response = await PATCH(
      new Request("http://localhost/api/market/views/3", {
        method: "PATCH",
        body: JSON.stringify({ name: "重命名" }),
      }),
      { params: Promise.resolve({ id: "3" }) }
    );
    expect(response.status).toBe(200);
    expect(renameMock).toHaveBeenCalledWith("u-1", 3, "重命名");
  });

  it("updates filters", async () => {
    tokenMock.mockResolvedValue("token-1");
    userIdMock.mockResolvedValue("u-1");
    updateFiltersMock.mockResolvedValue({ id: 3, name: "北京", filters: {}, createdAt: "", updatedAt: "" });
    const response = await PATCH(
      new Request("http://localhost/api/market/views/3", {
        method: "PATCH",
        body: JSON.stringify({ filters: { city: "北京" } }),
      }),
      { params: Promise.resolve({ id: "3" }) }
    );
    expect(response.status).toBe(200);
    expect(updateFiltersMock).toHaveBeenCalledWith("u-1", 3, expect.objectContaining({ city: "北京" }));
  });

  it("deletes a view", async () => {
    tokenMock.mockResolvedValue("token-1");
    userIdMock.mockResolvedValue("u-1");
    deleteMock.mockResolvedValue(true);
    const response = await DELETE(
      new Request("http://localhost/api/market/views/3", { method: "DELETE" }),
      { params: Promise.resolve({ id: "3" }) }
    );
    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("u-1", 3);
  });
});
