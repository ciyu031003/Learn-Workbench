import { beforeEach, describe, expect, it, vi } from "vitest";
import { learningTracks } from "@learn-workbench/content";

vi.mock("@/lib/db", () => ({
  pgPool: { query: vi.fn() },
}));

import { pgPool } from "@/lib/db";
import { learningCatalog, learningProgress, learningReviewQueue, recordLearningAttempt } from "./learning";

const queryMock = vi.mocked(pgPool.query);

function row(overrides: Record<string, unknown> = {}) {
  return {
    question_key: "py-q1",
    track_slug: "python",
    stage_key: "python-foundation",
    is_correct: true,
    created_at: "2026-10-09T08:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("learning catalog", () => {
  it("strips answers and explanations from the public payload", () => {
    const tracks = learningCatalog();
    const python = tracks.find((track) => track.slug === "python");
    expect(python).toBeDefined();
    expect(python?.questionCount).toBe(python?.questions.length);
    expect(python?.questions[0]).toMatchObject({ answer: [], explanation: "" });
    const sourcePython = learningTracks.find((track) => track.slug === "python");
    expect(sourcePython).toBeDefined();
    expect(JSON.stringify(tracks)).not.toContain(sourcePython?.questions[0]?.explanation);
  });
});

describe("recordLearningAttempt", () => {
  it("uses the question's canonical stage instead of trusting the client", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ created_at: "2026-10-09T08:00:00.000Z" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await recordLearningAttempt("u-1", {
      questionKey: "py-q1",
      trackSlug: "python",
      stageKey: "forged-stage",
      chosenAnswer: ["B"],
    });

    expect(result.stageKey).toBe("python-foundation");
    expect(queryMock.mock.calls[0]?.[1]).toEqual([
      "u-1",
      "python",
      "python-foundation",
      "py-q1",
      JSON.stringify(["B"]),
      true,
    ]);
    expect(queryMock.mock.calls[1]?.[1]).toEqual([
      "u-1",
      "py-q1",
      "python",
      "python-foundation",
      true,
    ]);
  });

  it("rejects an unknown question", async () => {
    await expect(
      recordLearningAttempt("u-1", {
        questionKey: "missing",
        trackSlug: "python",
        stageKey: "python-foundation",
        chosenAnswer: ["A"],
      })
    ).rejects.toThrow();
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("learningProgress", () => {
  it("returns recent attempts in database time order", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          row({ question_key: "py-q1" }),
          row({ question_key: "py-q2", is_correct: false, created_at: "2026-10-09T09:00:00.000Z" }),
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          row({ question_key: "py-q2", is_correct: false, created_at: "2026-10-09T09:00:00.000Z" }),
          row({ question_key: "py-q1", created_at: "2026-10-09T08:00:00.000Z" }),
        ],
      } as never);

    const now = new Date("2026-10-09T09:00:00.000Z");
    const progress = await learningProgress("u-1", undefined, now);

    // 掌握度=加权正确率×(0.6+0.4×时间新鲜度)：最近一次答错、前一次答对且刚练过 → 33
    expect(progress).toMatchObject({ attempted: 2, correct: 1, wrong: 1, mastery: 33, today: 2 });
    expect(progress.masteryBasis).toMatchObject({ window: 5, accuracyWeight: 0.6, recencyWeight: 0.4 });
    expect(progress.masteryBasis.decay).toBeCloseTo(1, 5);
    expect(progress.recent.map((attempt) => attempt.questionKey)).toEqual(["py-q2", "py-q1"]);
    expect(String(queryMock.mock.calls[1]?.[0])).toContain("ORDER BY created_at DESC");
  });
});

describe("learningReviewQueue", () => {
  it("keeps only cards that are due and not mastered, newest-due first", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { question_key: "a", track_slug: "python", stage_key: "s1", status: "review", interval_days: 3, ease: "2.50", streak: 2, lapses: 0, due_at: "2026-10-01T00:00:00.000Z", last_result: true },
        { question_key: "b", track_slug: "python", stage_key: "s1", status: "mastered", interval_days: 30, ease: "2.80", streak: 6, lapses: 0, due_at: "2026-10-01T00:00:00.000Z", last_result: true },
        { question_key: "c", track_slug: "java", stage_key: "s2", status: "learning", interval_days: 1, ease: "2.30", streak: 0, lapses: 1, due_at: "2026-12-31T00:00:00.000Z", last_result: false },
      ],
    } as never);

    const queue = await learningReviewQueue("u-1", new Date("2026-10-10T00:00:00.000Z"));

    expect(queue.cards.map((card) => card.questionKey)).toEqual(["a"]);
    expect(queue.cards[0]).toMatchObject({ ease: 2.5, dueAt: "2026-10-01T00:00:00.000Z", status: "review" });
    expect(queue).toMatchObject({ dueCount: 1, totalCount: 3, masteredCount: 1 });
  });
});
