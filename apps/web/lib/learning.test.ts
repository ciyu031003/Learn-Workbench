import { beforeEach, describe, expect, it, vi } from "vitest";
import { learningTracks } from "@learn-workbench/content";

vi.mock("@/lib/db", () => ({
  pgPool: { query: vi.fn(), connect: vi.fn() },
}));

import { pgPool } from "@/lib/db";
import {
  learningCatalog,
  learningProgress,
  learningReviewQueue,
  mutateLearningReview,
  recordLearningAttempt,
} from "./learning";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);

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

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    question_key: "py-q1",
    track_slug: "python",
    stage_key: "python-foundation",
    topic_key: "python-foundation",
    status: "learning",
    interval_days: 0,
    ease: "2.50",
    streak: 0,
    lapses: 0,
    due_at: "2026-10-09T08:00:00.000Z",
    last_result: null,
    algorithm_version: "sm2-lwb-v2",
    schedule_reason: "initial",
    suspended_from_status: null,
    updated_at: "2026-10-09T08:00:00.000Z",
    ...overrides,
  };
}

function mockClient() {
  const query = vi.fn();
  const release = vi.fn();
  connectMock.mockResolvedValue({ query, release } as never);
  return { query, release };
}

beforeEach(() => {
  vi.resetAllMocks();
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
  it("uses canonical question metadata and advances the card once in a transaction", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "11", created_at: "2026-10-09T08:00:00.000Z" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [reviewRow()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await recordLearningAttempt(
      "u-1",
      {
        questionKey: "py-q1",
        trackSlug: "python",
        stageKey: "forged-stage",
        chosenAnswer: ["B"],
        clientId: "attempt-client-1",
      },
      new Date("2026-10-09T08:00:00.000Z")
    );

    expect(result.stageKey).toBe("python-foundation");
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    const insertAttempt = client.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO learning_attempts"));
    expect(insertAttempt?.[1]).toEqual([
      "u-1",
      "python",
      "python-foundation",
      "py-q1",
      JSON.stringify(["B"]),
      true,
      "attempt-client-1",
    ]);
    const update = client.query.mock.calls.find(([sql]) => String(sql).includes("UPDATE learning_review_cards"));
    expect(update?.[1]).toContain(1);
    expect(update?.[1]).toContain("correct_answer");
    expect(String(update?.[0])).toContain("fsrs_state = CASE WHEN $17");
    expect(update?.[1]).toContain(true);
    expect(client.release).toHaveBeenCalled();
  });

  it("leaves the stored shadow untouched when the user has disabled shadow mode", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "12", created_at: "2026-10-09T08:00:00.000Z" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [reviewRow({ fsrs_state: { due: "2026-10-20T00:00:00.000Z" } })] })
      .mockResolvedValueOnce({ rows: [{ track_slug: "*", mode: "off" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await recordLearningAttempt(
      "u-1",
      {
        questionKey: "py-q1",
        trackSlug: "python",
        stageKey: "python-foundation",
        chosenAnswer: ["B"],
        clientId: "attempt-client-2",
      },
      new Date("2026-10-09T08:00:00.000Z")
    );

    const update = client.query.mock.calls.find(([sql]) => String(sql).includes("UPDATE learning_review_cards"));
    expect(update?.[1]).toContain(false);
    expect(String(update?.[0])).toContain("CASE WHEN $17 THEN $18::jsonb ELSE fsrs_state END");
  });

  it("does not advance the card again when clientId is replayed", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "11", created_at: "2026-10-09T08:00:00.000Z" }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await recordLearningAttempt("u-1", {
      questionKey: "py-q1",
      trackSlug: "python",
      stageKey: "python-foundation",
      chosenAnswer: ["B"],
      clientId: "attempt-client-1",
    });

    expect(result.createdAt).toBe("2026-10-09T08:00:00.000Z");
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE learning_review_cards"))).toBe(false);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });

  it("rejects an unknown question before opening a transaction", async () => {
    await expect(
      recordLearningAttempt("u-1", {
        questionKey: "missing",
        trackSlug: "python",
        stageKey: "python-foundation",
        chosenAnswer: ["A"],
      })
    ).rejects.toThrow();
    expect(connectMock).not.toHaveBeenCalled();
  });
});

describe("learningProgress", () => {
  it("returns recent attempts in database time order and keeps the local-day basis", async () => {
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
    const progress = await learningProgress("u-1", undefined, now, "Asia/Shanghai");

    expect(progress).toMatchObject({ attempted: 2, correct: 1, wrong: 1, mastery: 33, today: 2 });
    expect(progress.masteryBasis).toMatchObject({
      window: 5,
      sampleSize: 2,
      questionCount: 2,
      method: "bounded_recent_accuracy_with_recency",
    });
    expect(progress.masteryBasis.latestAttemptAt).toBe("2026-10-09T09:00:00.000Z");
    expect(progress.masteryBasis.decay).toBeCloseTo(1, 5);
    expect(progress.recent.map((attempt) => attempt.questionKey)).toEqual(["py-q2", "py-q1"]);
    expect(String(queryMock.mock.calls[1]?.[0])).toContain("ORDER BY created_at DESC");
  });
});

describe("learningReviewQueue", () => {
  it("keeps only due active cards and returns explainable weak topics", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        reviewRow({
          question_key: "py-q1",
          status: "review",
          interval_days: 3,
          streak: 2,
          due_at: "2026-10-01T00:00:00.000Z",
          last_result: false,
        }),
        reviewRow({
          question_key: "py-q2",
          status: "mastered",
          interval_days: 30,
          streak: 6,
          due_at: "2026-10-01T00:00:00.000Z",
        }),
        reviewRow({
          question_key: "py-q3",
          status: "suspended",
          interval_days: 1,
          due_at: "2026-10-01T00:00:00.000Z",
          suspended_from_status: "review",
        }),
        reviewRow({
          question_key: "py-q4",
          status: "learning",
          interval_days: 1,
          lapses: 1,
          due_at: "2026-12-31T00:00:00.000Z",
          last_result: false,
        }),
      ],
    } as never);

    const queue = await learningReviewQueue("u-1", new Date("2026-10-10T00:00:00.000Z"), "due");

    expect(queue.cards.map((card) => card.questionKey)).toEqual(["py-q1"]);
    expect(queue).toMatchObject({ dueCount: 1, totalCount: 4, masteredCount: 1, suspendedCount: 1 });
    expect(queue.weakTopics[0]).toMatchObject({
      trackSlug: "python",
      stageKey: "python-foundation",
      dueCount: 1,
      wrongCount: 2,
    });
  });
});

describe("mutateLearningReview", () => {
  it("treats a repeated clientId as an idempotent no-op", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);

    const result = await mutateLearningReview(
      "u-1",
      {
        action: "pause",
        questionKeys: ["py-q1"],
        clientId: "review-client-1",
      },
      new Date("2026-10-10T00:00:00.000Z")
    );

    expect(result).toMatchObject({ duplicate: true, applied: 0 });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("SELECT question_key"))).toBe(false);
  });

  it("snoozes a due card without losing its schedule state", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "9" }] })
      .mockResolvedValueOnce({
        rows: [
          reviewRow({
            question_key: "py-q1",
            status: "review",
            interval_days: 3,
            due_at: "2026-10-09T00:00:00.000Z",
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);

    const result = await mutateLearningReview(
      "u-1",
      {
        action: "snooze",
        questionKeys: ["py-q1"],
        clientId: "review-client-2",
        snoozeDays: 1,
        snoozeUntil: "2026-10-11T00:00:00.000Z",
      },
      new Date("2026-10-10T00:00:00.000Z")
    );

    const update = client.query.mock.calls.find(([sql]) => String(sql).includes("UPDATE learning_review_cards"));
    expect(update?.[1]).toContain("2026-10-11T00:00:00.000Z");
    expect(update?.[1]).toContain("snoozed_1d");
    expect(result.applied).toBe(1);
  });
});
