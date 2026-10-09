import { beforeEach, describe, expect, it, vi } from "vitest";
import { learningTracks } from "@learn-workbench/content";

vi.mock("@/lib/db", () => ({
  pgPool: { query: vi.fn() },
}));

import { pgPool } from "@/lib/db";
import { learningCatalog, learningProgress, recordLearningAttempt } from "./learning";

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
          row({ question_key: "py-q2", is_correct: false }),
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          row({ question_key: "py-q2", is_correct: false, created_at: "2026-10-09T09:00:00.000Z" }),
          row({ question_key: "py-q1", created_at: "2026-10-09T08:00:00.000Z" }),
        ],
      } as never);

    const progress = await learningProgress("u-1");

    expect(progress).toMatchObject({ attempted: 2, correct: 1, wrong: 1, mastery: 50 });
    expect(progress.recent.map((attempt) => attempt.questionKey)).toEqual(["py-q2", "py-q1"]);
    expect(String(queryMock.mock.calls[1]?.[0])).toContain("ORDER BY created_at DESC");
  });
});
