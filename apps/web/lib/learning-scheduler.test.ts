import { describe, expect, it } from "vitest";
import {
  applyLearningReviewAction,
  learningDayKey,
  scheduleLearningReview,
  type LearningReviewCard,
} from "@learn-workbench/shared";

const now = new Date("2026-10-13T00:00:00.000Z");

function card(overrides: Partial<LearningReviewCard> = {}): LearningReviewCard {
  return {
    questionKey: "q1",
    trackSlug: "python",
    stageKey: "python-foundation",
    topicKey: "python-list",
    status: "learning",
    intervalDays: 0,
    ease: 2.5,
    streak: 0,
    lapses: 0,
    dueAt: now.toISOString(),
    lastResult: null,
    algorithmVersion: "sm2-lwb-v2",
    scheduleReason: "initial",
    suspendedFromStatus: null,
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("scheduleLearningReview", () => {
  it("follows the stable 1 / 3 / 7 / interval × ease ladder", () => {
    const first = scheduleLearningReview({ state: card(), isCorrect: true, now });
    expect(first).toMatchObject({ intervalDays: 1, status: "review", streak: 1, scheduleReason: "correct_answer" });

    const second = scheduleLearningReview({
      state: card({ intervalDays: 1, streak: 1 }),
      isCorrect: true,
      now,
    });
    expect(second.intervalDays).toBe(3);

    const third = scheduleLearningReview({
      state: card({ intervalDays: 3, streak: 2 }),
      isCorrect: true,
      now,
    });
    expect(third.intervalDays).toBe(7);

    const fourth = scheduleLearningReview({
      state: card({ intervalDays: 7, streak: 3, ease: 2.5 }),
      isCorrect: true,
      now,
    });
    expect(fourth).toMatchObject({ intervalDays: 18, status: "mastered", streak: 4 });
    expect(fourth.dueAt).toBe("2026-10-31T00:00:00.000Z");
  });

  it("returns to one day and lowers ease on a wrong answer", () => {
    const result = scheduleLearningReview({
      state: card({ intervalDays: 30, streak: 5, ease: 2.5, lapses: 1 }),
      isCorrect: false,
      now,
    });
    expect(result).toMatchObject({
      intervalDays: 1,
      status: "learning",
      streak: 0,
      lapses: 2,
      ease: 2.3,
      scheduleReason: "wrong_answer",
    });
  });

  it("resumes a suspended card when an offline attempt arrives", () => {
    const result = scheduleLearningReview({
      state: card({
        status: "suspended",
        intervalDays: 3,
        streak: 2,
        suspendedFromStatus: "review",
      }),
      isCorrect: true,
      now,
    });
    expect(result).toMatchObject({
      status: "review",
      scheduleReason: "resumed_by_correct_attempt",
      suspendedFromStatus: null,
    });
  });
});

describe("review plan actions", () => {
  it("snoozes from the later of now and the current due time", () => {
    const result = applyLearningReviewAction({
      card: card({ status: "review", intervalDays: 3, dueAt: "2026-10-01T00:00:00.000Z" }),
      action: "snooze",
      now,
      snoozeDays: 2,
    });
    expect(result.dueAt).toBe("2026-10-15T00:00:00.000Z");
    expect(result.scheduleReason).toBe("snoozed_2d");
  });

  it("pauses, resumes, and completes without losing the prior status", () => {
    const paused = applyLearningReviewAction({ card: card({ status: "review" }), action: "pause", now });
    expect(paused).toMatchObject({ status: "suspended", suspendedFromStatus: "review" });

    const resumed = applyLearningReviewAction({ card: paused, action: "resume", now });
    expect(resumed).toMatchObject({ status: "review", suspendedFromStatus: null });

    const completed = applyLearningReviewAction({ card: resumed, action: "complete", now });
    expect(completed).toMatchObject({ status: "mastered", scheduleReason: "completed_by_user" });
  });
});

describe("learningDayKey", () => {
  it("uses the requested timezone instead of UTC", () => {
    const iso = "2026-10-12T16:30:00.000Z";
    expect(learningDayKey(iso)).toBe("2026-10-12");
    expect(learningDayKey(iso, "Asia/Shanghai")).toBe("2026-10-13");
  });

  it("falls back safely for invalid timezones", () => {
    expect(learningDayKey("2026-10-12T16:30:00.000Z", "Invalid/Zone")).toBe("2026-10-12");
  });
});
