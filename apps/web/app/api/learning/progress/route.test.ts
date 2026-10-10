import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning", () => ({ learningProgress: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { learningProgress } from "@/lib/learning";
import { GET } from "./route";

const userMock = vi.mocked(currentUserId);
const progressMock = vi.mocked(learningProgress);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/learning/progress", () => {
  it("returns 401 when logged out", async () => {
    userMock.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"))).status).toBe(401);
  });

  it("passes the track filter", async () => {
    userMock.mockResolvedValue("u-1");
    progressMock.mockResolvedValue({
      attempted: 2,
      correct: 1,
      wrong: 1,
      mastery: 50,
      masteryBasis: { window: 5, accuracyWeight: 0.6, recencyWeight: 0.4, lambda: 0.05, weightedAccuracy: 0.5, decay: 1 },
      today: 2,
      recent: [],
    });
    const res = await GET(new Request("http://localhost?track=python"));
    expect(res.status).toBe(200);
    expect(progressMock).toHaveBeenCalledWith("u-1", "python");
  });
});
