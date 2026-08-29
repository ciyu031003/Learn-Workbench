import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/interview", () => ({
  listAttempts: vi.fn(),
  interviewStats: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { listAttempts, interviewStats } from "@/lib/interview";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listAttempts);
const statsMock = vi.mocked(interviewStats);
const errorMock = vi.mocked(logger.error);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/questions/attempts", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns attempts and stats", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([]);
    statsMock.mockResolvedValue({ total: 0, correct: 0, interviewCount: 0, avgRating: null, byModule: [] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).attempts).toEqual([]);
    expect(listMock).toHaveBeenCalledWith("u-1");
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
