import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning", () => ({ learningReviewQueue: vi.fn(), mutateLearningReview: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { learningReviewQueue, mutateLearningReview } from "@/lib/learning";
import { GET, PATCH } from "./route";

const userMock = vi.mocked(currentUserId);
const queueMock = vi.mocked(learningReviewQueue);
const mutateMock = vi.mocked(mutateLearningReview);

beforeEach(() => vi.clearAllMocks());

function req(method: "GET" | "PATCH", body?: unknown, url = "http://localhost/api/learning/review") {
  return new Request(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
}

describe("GET /api/learning/review", () => {
  it("returns 401 when logged out", async () => {
    userMock.mockResolvedValue(null);
    expect((await GET(req("GET"))).status).toBe(401);
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
          topicKey: "python-list",
          status: "review",
          intervalDays: 3,
          ease: 2.5,
          streak: 2,
          lapses: 1,
          dueAt: "2026-10-01T00:00:00.000Z",
          lastResult: false,
          algorithmVersion: "sm2-lwb-v2",
          scheduleReason: "wrong_answer",
          suspendedFromStatus: null,
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      weakTopics: [],
      dueCount: 1,
      totalCount: 4,
      masteredCount: 2,
      suspendedCount: 0,
      generatedAt: "2026-10-10T00:00:00.000Z",
    });
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ dueCount: 1, totalCount: 4, masteredCount: 2 });
    expect(queueMock).toHaveBeenCalledWith("u-1", expect.any(Date), "due");
  });

  it("supports scope=all for plan management", async () => {
    userMock.mockResolvedValue("u-1");
    queueMock.mockResolvedValue({
      cards: [],
      weakTopics: [],
      dueCount: 0,
      totalCount: 0,
      masteredCount: 0,
      suspendedCount: 0,
      generatedAt: "2026-10-10T00:00:00.000Z",
    });
    await GET(req("GET", undefined, "http://localhost/api/learning/review?scope=all"));
    expect(queueMock).toHaveBeenCalledWith("u-1", expect.any(Date), "all");
  });
});

describe("PATCH /api/learning/review", () => {
  it("rejects invalid input", async () => {
    userMock.mockResolvedValue("u-1");
    const res = await PATCH(req("PATCH", { action: "snooze", questionKeys: [], clientId: "short" }));
    expect(res.status).toBe(400);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("applies an idempotent plan action", async () => {
    userMock.mockResolvedValue("u-1");
    mutateMock.mockResolvedValue({
      cards: [],
      weakTopics: [],
      dueCount: 0,
      totalCount: 1,
      masteredCount: 0,
      suspendedCount: 1,
      generatedAt: "2026-10-10T00:00:00.000Z",
      applied: 1,
      duplicate: false,
    });
    const res = await PATCH(
      req("PATCH", {
        action: "pause",
        questionKeys: ["py-q1"],
        clientId: "review-client-123",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ applied: 1, suspendedCount: 1 });
    expect(mutateMock).toHaveBeenCalledWith(
      "u-1",
      expect.objectContaining({ action: "pause", questionKeys: ["py-q1"] })
    );
  });
});
