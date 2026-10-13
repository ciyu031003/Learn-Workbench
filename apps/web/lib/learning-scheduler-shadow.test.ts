import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  pgPool: { query: vi.fn() },
}));

import { pgPool } from "@/lib/db";
import { advanceFsrsShadow } from "./fsrs-shadow";
import {
  learningSchedulerStatus,
  setLearningSchedulerMode,
  shouldComputeFsrsShadow,
} from "./learning-scheduler";

const queryMock = vi.mocked(pgPool.query);
const now = new Date("2026-10-13T00:00:00.000Z");

function shadowAwareQuery(sql: string, values?: unknown[]) {
  if (String(sql).includes("INSERT INTO learning_scheduler_settings")) {
    return Promise.resolve({ rows: [] });
  }
  if (String(sql).includes("FROM learning_scheduler_settings")) {
    const trackSlug = values?.[1];
    return Promise.resolve({
      rows:
        trackSlug === "python"
          ? [{ track_slug: "*", mode: "shadow" }, { track_slug: "python", mode: "off" }]
          : [{ track_slug: "*", mode: "shadow" }],
    });
  }
  if (String(sql).includes("FROM learning_attempts")) {
    return Promise.resolve({
      rows: [
        { question_key: "py-q1", is_correct: true, created_at: "2026-10-11T00:00:00.000Z" },
        { question_key: "py-q1", is_correct: false, created_at: "2026-10-12T00:00:00.000Z" },
      ],
    });
  }
  if (String(sql).includes("FROM learning_review_cards")) {
    return Promise.resolve({
      rows: [
        {
          question_key: "py-q1",
          due_at: "2026-10-16T00:00:00.000Z",
          fsrs_state: null,
          fsrs_due_at: null,
          fsrs_stability: null,
          fsrs_difficulty: null,
          fsrs_last_review_at: null,
          fsrs_updated_at: null,
        },
      ],
    });
  }
  return Promise.resolve({ rows: [] });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("shouldComputeFsrsShadow", () => {
  it("defaults to shadow when the user has no explicit setting", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await expect(shouldComputeFsrsShadow((sql, values) => queryMock(sql, values), "u-1", "python")).resolves.toBe(true);
  });

  it("lets a track-level off override a global shadow setting", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { track_slug: "*", mode: "shadow" },
        { track_slug: "python", mode: "off" },
      ],
    } as never);
    await expect(shouldComputeFsrsShadow((sql, values) => queryMock(sql, values), "u-1", "python")).resolves.toBe(false);
  });

  it("honors a global off switch when the track has no override", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ track_slug: "*", mode: "off" }] } as never);
    await expect(shouldComputeFsrsShadow((sql, values) => queryMock(sql, values), "u-1", "java")).resolves.toBe(false);
  });
});

describe("learningSchedulerStatus", () => {
  it("replays historical attempts and reports horizon differences", async () => {
    queryMock.mockImplementationOnce(shadowAwareQuery as never).mockImplementationOnce(shadowAwareQuery as never).mockImplementationOnce(shadowAwareQuery as never);

    const status = await learningSchedulerStatus("u-1", undefined, now);

    expect(status).toMatchObject({
      mode: "shadow",
      modeSource: "global",
      trackSlug: null,
      evaluation: {
        source: "replayed_attempts",
        sampleCount: 1,
        shadowedCount: 1,
        coverage: 1,
      },
    });
    expect(status.evaluation.horizons).toHaveLength(3);
    expect(status.evaluation.horizons.map((item) => item.days)).toEqual([7, 14, 30]);
  });

  it("falls back to the stored shadow when no attempt history is replayable", async () => {
    const stored = advanceFsrsShadow(null, true, now);
    queryMock.mockImplementation((sql: string) => {
      if (String(sql).includes("FROM learning_scheduler_settings")) {
        return Promise.resolve({ rows: [] });
      }
      if (String(sql).includes("FROM learning_attempts")) {
        return Promise.resolve({ rows: [] });
      }
      if (String(sql).includes("FROM learning_review_cards")) {
        return Promise.resolve({
          rows: [
            {
              question_key: "py-q1",
              due_at: "2026-10-16T00:00:00.000Z",
              fsrs_state: stored.card,
              fsrs_due_at: stored.dueAt,
              fsrs_stability: stored.stability,
              fsrs_difficulty: stored.difficulty,
              fsrs_last_review_at: stored.lastReviewAt,
              fsrs_updated_at: stored.updatedAt,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const status = await learningSchedulerStatus("u-1", undefined, now);
    expect(status.evaluation).toMatchObject({ source: "stored_shadow", shadowedCount: 1, coverage: 1 });
  });
});

describe("setLearningSchedulerMode", () => {
  it("upserts the idempotent target mode and returns the effective setting", async () => {
    let upsertValues: unknown[] | undefined;
    queryMock.mockImplementation((sql: string, values?: unknown[]) => {
      if (String(sql).includes("INSERT INTO learning_scheduler_settings")) {
        upsertValues = values;
        return Promise.resolve({ rows: [] });
      }
      return shadowAwareQuery(sql, values);
    });

    const status = await setLearningSchedulerMode("u-1", { action: "disable_shadow", trackSlug: "python" }, now);

    expect(upsertValues).toEqual(["u-1", "python", "off"]);
    expect(status).toMatchObject({ mode: "off", modeSource: "track", trackSlug: "python" });
  });
});
