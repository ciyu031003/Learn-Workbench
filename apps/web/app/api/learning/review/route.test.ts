import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning", () => ({ learningReviewQueue: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { learningReviewQueue } from "@/lib/learning";
import { GET } from "./route";

const userMock = vi.mocked(currentUserId);
const queueMock = vi.mocked(learningReviewQueue);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/learning/review", () => {
  it("returns 401 when logged out", async () => {
    userMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(queueMock).not.toHaveBeenCalled();
  });

  it("returns the due queue for the current user", async () => {
    userMock.mockResolvedValue("u-1");
    queueMock.mockResolvedValue({
      cards: [
        {
          questionKey: "py-q1",
          trackSlug: "python",
          stageKey: "python-foundation",
          status: "review",
          intervalDays: 3,
          ease: 2.5,
          streak: 2,
          lapses: 1,
          dueAt: "2026-10-01T00:00:00.000Z",
          lastResult: false,
        },
      ],
      dueCount: 1,
      totalCount: 4,
      masteredCount: 2,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ dueCount: 1, totalCount: 4, masteredCount: 2 });
    expect(queueMock).toHaveBeenCalledWith("u-1");
  });
});
