import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/jobs";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const markOneMock = vi.mocked(markNotificationRead);
const markAllMock = vi.mocked(markAllNotificationsRead);
beforeEach(() => vi.clearAllMocks());

describe("POST /api/jobs/notifications/read", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("marks all when id is 'all' or null", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    let res = await POST(jsonReq({ id: "all" }));
    expect(res.status).toBe(200);
    expect((await res.json()).all).toBe(true);
    expect(markAllMock).toHaveBeenCalledWith("u-1");

    res = await POST(jsonReq({ id: null }));
    expect(res.status).toBe(200);
    expect(markAllMock).toHaveBeenCalledTimes(2);
  });

  it("returns 400 for invalid id", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(jsonReq({ id: -3 }));
    expect(res.status).toBe(400);
  });

  it("marks a single notification", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(jsonReq({ id: 5 }));
    expect(res.status).toBe(200);
    expect(markOneMock).toHaveBeenCalledWith("u-1", 5);
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
