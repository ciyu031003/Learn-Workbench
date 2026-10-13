import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import {
  FSRS_SHADOW_ALGORITHM_VERSION,
  advanceFsrsShadow,
  evaluateFsrsShadow,
  replayFsrsShadows,
} from "./fsrs-shadow";

const now = new Date("2026-10-13T00:00:00.000Z");

describe("advanceFsrsShadow", () => {
  it("advances an empty shadow card without touching the SM-2 owner", () => {
    const first = advanceFsrsShadow(null, true, now);
    expect(first.algorithmVersion).toBe(FSRS_SHADOW_ALGORITHM_VERSION);
    expect(first.card.reps).toBe(1);
    expect(first.card.state).toBe(State.Learning);
    expect(Date.parse(first.dueAt)).toBeGreaterThan(now.getTime());
    expect(first.lastReviewAt).toBe(now.toISOString());

    const second = advanceFsrsShadow(first.card, true, new Date("2026-10-13T00:10:00.000Z"));
    expect(second.card.reps).toBe(2);
    expect(second.card.state).toBe(State.Review);
  });

  it("records a lapse when the shadow answer is wrong", () => {
    const first = advanceFsrsShadow(null, true, now);
    const review = advanceFsrsShadow(first.card, true, new Date("2026-10-13T00:10:00.000Z"));
    const wrong = advanceFsrsShadow(review.card, false, new Date("2026-10-13T00:20:00.000Z"));
    expect(wrong.card.lapses).toBe(1);
    expect(wrong.card.state).toBe(State.Relearning);
  });
});

describe("replayFsrsShadows", () => {
  it("replays attempts in deterministic time order per question", () => {
    const attempts = [
      { questionKey: "q1", isCorrect: false, createdAt: "2026-10-14T00:00:00.000Z" },
      { questionKey: "q2", isCorrect: true, createdAt: "2026-10-13T00:00:00.000Z" },
      { questionKey: "q1", isCorrect: true, createdAt: "2026-10-13T00:00:00.000Z" },
    ];
    const replayed = replayFsrsShadows(attempts);
    const manual = advanceFsrsShadow(
      advanceFsrsShadow(null, true, new Date("2026-10-13T00:00:00.000Z")),
      false,
      new Date("2026-10-14T00:00:00.000Z")
    );

    expect([...replayed.keys()].sort()).toEqual(["q1", "q2"]);
    expect(replayed.get("q1")?.dueAt).toBe(manual.dueAt);
    expect(replayed.get("q2")?.card.reps).toBe(1);
  });
});

describe("evaluateFsrsShadow", () => {
  it("reports horizon overlaps, due-day drift, coverage, and state counts", () => {
    const base = advanceFsrsShadow(null, true, now);
    const shadows = new Map([
      ["q1", { ...base, dueAt: "2026-10-20T00:00:00.000Z" }],
      ["q2", { ...base, dueAt: "2026-10-23T00:00:00.000Z" }],
    ]);
    const evaluation = evaluateFsrsShadow({
      cards: [
        { questionKey: "q1", sm2DueAt: "2026-10-16T00:00:00.000Z" },
        { questionKey: "q2", sm2DueAt: "2026-10-26T00:00:00.000Z" },
      ],
      shadows,
      source: "replayed_attempts",
      now,
    });

    expect(evaluation).toMatchObject({
      algorithmVersion: FSRS_SHADOW_ALGORITHM_VERSION,
      source: "replayed_attempts",
      sampleCount: 2,
      shadowedCount: 2,
      coverage: 1,
      meanAbsoluteDueDayDiff: 3.5,
      p90AbsoluteDueDayDiff: 4,
      stateCounts: { new: 0, learning: 2, review: 0, relearning: 0 },
    });
    expect(evaluation.horizons.find((item) => item.days === 7)).toMatchObject({
      sm2DueCount: 1,
      fsrsDueCount: 1,
      overlapCount: 1,
      sm2OnlyCount: 0,
      fsrsOnlyCount: 0,
    });
    expect(evaluation.horizons.find((item) => item.days === 14)).toMatchObject({
      sm2DueCount: 2,
      fsrsDueCount: 2,
      overlapCount: 2,
      sm2OnlyCount: 0,
      fsrsOnlyCount: 0,
    });
  });

  it("reports zero coverage when no shadow state exists yet", () => {
    const evaluation = evaluateFsrsShadow({
      cards: [{ questionKey: "q1", sm2DueAt: now.toISOString() }],
      shadows: new Map(),
      source: "replayed_attempts",
      now,
    });
    expect(evaluation).toMatchObject({
      sampleCount: 1,
      shadowedCount: 0,
      coverage: 0,
      meanAbsoluteDueDayDiff: null,
      p90AbsoluteDueDayDiff: null,
    });
    expect(evaluation.horizons.every((item) => item.fsrsDueCount === 0)).toBe(true);
  });
});
