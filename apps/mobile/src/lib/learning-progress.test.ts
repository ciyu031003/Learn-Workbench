import { describe, expect, it, vi } from "vitest";
import { learningTracks } from "@learn-workbench/content";
import {
  isLearningAnswerCorrect,
  pickLearningQuestions,
  summarizeLearningAttempts,
  wrongQuestionKeys,
  type LearningAttempt,
} from "./learning-progress";
import { localKey } from "./focus-series";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

const python = learningTracks.find((track) => track.slug === "python") ?? learningTracks[0];

function attempt(key: string, isCorrect: boolean, createdAt: string): LearningAttempt {
  return {
    questionKey: key,
    trackSlug: python.slug,
    stageKey: python.questions[0].stageKey,
    chosenAnswer: ["A"],
    isCorrect,
    createdAt,
  };
}

describe("learning progress", () => {
  it("grades multi-answer questions without depending on order", () => {
    const question = { ...python.questions[0], answer: ["A", "B"] };
    expect(isLearningAnswerCorrect(question, ["B", "A"])).toBe(true);
    expect(isLearningAnswerCorrect(question, ["A"])).toBe(false);
  });

  it("summarizes the latest result per question", () => {
    const first = python.questions[0].key;
    const second = python.questions[1].key;
    const summary = summarizeLearningAttempts(
      [
        attempt(first, false, "2026-10-08T10:00:00.000Z"),
        attempt(first, true, "2026-10-09T10:00:00.000Z"),
        attempt(second, true, "2026-10-09T11:00:00.000Z"),
      ],
      python.questions.slice(0, 2),
      "2026-10-09",
      new Date("2026-10-09T11:00:00.000Z")
    );
    expect(summary).toMatchObject({ attempted: 2, correct: 2, wrong: 0, mastery: 100, today: 2 });
    expect(summary.masteryBasis).toMatchObject({ window: 5, weightedAccuracy: 1 });
    expect(summary.masteryBasis.decay).toBeCloseTo(1, 5);
  });

  it("counts today on the device's local calendar", () => {
    const first = python.questions[0].key;
    const createdAt = "2026-10-08T16:30:00.000Z";
    const summary = summarizeLearningAttempts(
      [attempt(first, true, createdAt)],
      [python.questions[0]],
      localKey(new Date(createdAt))
    );
    expect(summary.today).toBe(1);
  });

  it("returns deterministic question sets", () => {
    const a = pickLearningQuestions(python, { count: 4, seed: "daily-2026-10-09" });
    const b = pickLearningQuestions(python, { count: 4, seed: "daily-2026-10-09" });
    expect(a.map((item) => item.key)).toEqual(b.map((item) => item.key));
  });

  it("keeps only the latest wrong questions", () => {
    const key = python.questions[0].key;
    expect(
      wrongQuestionKeys([
        attempt(key, false, "2026-10-08T10:00:00.000Z"),
        attempt(key, true, "2026-10-09T10:00:00.000Z"),
      ])
    ).toEqual([]);
  });

  it("prefers questions bound to the requested topic", () => {
    const topicKey = python.stages[0].topics[0].key;
    const picked = pickLearningQuestions(python, {
      stageKey: "python-foundation",
      topicKey,
      count: 8,
      seed: "topic-practice",
    });
    expect(picked).toHaveLength(8);
    expect(picked.slice(0, 2).every((question) => question.topicKey === topicKey)).toBe(true);
    expect(picked.every((question) => question.stageKey === "python-foundation")).toBe(true);
  });

  it("falls back to the stage when a topic has no dedicated questions", () => {
    const picked = pickLearningQuestions(python, {
      stageKey: "python-foundation",
      topicKey: "missing-topic",
      count: 8,
      seed: "fallback",
    });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((question) => question.stageKey === "python-foundation")).toBe(true);
  });
});
