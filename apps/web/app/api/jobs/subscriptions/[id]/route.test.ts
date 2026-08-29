import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ deleteSubscription: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { deleteSubscription } from "@/lib/jobs";
import { DELETE } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const deleteMock = vi.mocked(deleteSubscription);
const ctx = { params: Promise.resolve({ id: "4" }) };
beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/jobs/subscriptions/[id]", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "0" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when nothing deleted", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    deleteMock.mockResolvedValue(false);
    const res = await DELETE(new Request("http://localhost"), ctx);
    expect(res.status).toBe(404);
  });

  it("deletes successfully", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    deleteMock.mockResolvedValue(true);
    const res = await DELETE(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("u-1", 4);
  });
});
