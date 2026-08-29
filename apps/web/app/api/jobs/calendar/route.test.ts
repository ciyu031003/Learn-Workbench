import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ listUpcomingExamEvents: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { listUpcomingExamEvents } from "@/lib/jobs";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const eventsMock = vi.mocked(listUpcomingExamEvents);
beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/calendar", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/jobs/calendar"));
    expect(res.status).toBe(401);
  });

  it("clamps the limit and returns events", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    eventsMock.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/jobs/calendar?limit=999"));
    expect(res.status).toBe(200);
    expect(eventsMock).toHaveBeenCalledWith(60);
    expect((await res.json()).events).toEqual([]);
  });
});
