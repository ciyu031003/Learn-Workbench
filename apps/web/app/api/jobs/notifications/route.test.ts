import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ listNotifications: vi.fn(), unreadNotificationCount: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { listNotifications, unreadNotificationCount } from "@/lib/jobs";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listNotifications);
const unreadMock = vi.mocked(unreadNotificationCount);
beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/notifications", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/jobs/notifications"));
    expect(res.status).toBe(401);
  });

  it("reads unread flag and clamped limit", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([]);
    unreadMock.mockResolvedValue(0);
    const res = await GET(new Request("http://localhost/api/jobs/notifications?unread=1&limit=100"));
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith("u-1", true, 60);
    expect((await res.json()).unread).toBe(0);
  });
});
