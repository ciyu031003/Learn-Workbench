import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";
import type {
  LearningSchedulerEvaluation,
  LearningSchedulerHorizon,
} from "@learn-workbench/shared";

export const FSRS_SHADOW_ALGORITHM_VERSION = "ts-fsrs@5.4.2/fsrs-v6";

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36_500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

export interface FsrsShadowSnapshot {
  algorithmVersion: string;
  card: Card;
  dueAt: string;
  stability: number;
  difficulty: number;
  lastReviewAt: string | null;
  updatedAt: string;
}

function iso(value: Date | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hydrateCard(raw: unknown, fallbackNow: Date): Card {
  if (!raw || typeof raw !== "object") return createEmptyCard(fallbackNow);
  const snapshot = raw as Partial<FsrsShadowSnapshot>;
  const candidate = (snapshot.card ?? raw) as Partial<Card>;
  const due = new Date(candidate.due ?? fallbackNow);
  if (Number.isNaN(due.getTime())) return createEmptyCard(fallbackNow);
  const lastReview = candidate.last_review ? new Date(candidate.last_review) : undefined;
  return {
    due,
    stability: Number(candidate.stability) || 0,
    difficulty: Number(candidate.difficulty) || 0,
    elapsed_days: Number(candidate.elapsed_days) || 0,
    scheduled_days: Number(candidate.scheduled_days) || 0,
    learning_steps: Number(candidate.learning_steps) || 0,
    reps: Number(candidate.reps) || 0,
    lapses: Number(candidate.lapses) || 0,
    state: Number.isInteger(candidate.state) ? (candidate.state as State) : State.New,
    ...(lastReview && !Number.isNaN(lastReview.getTime()) ? { last_review: lastReview } : {}),
  };
}

export function advanceFsrsShadow(
  current: unknown,
  isCorrect: boolean,
  now: Date
): FsrsShadowSnapshot {
  const card = hydrateCard(current, now);
  const next = scheduler.next(card, now, isCorrect ? Rating.Good : Rating.Again).card;
  return {
    algorithmVersion: FSRS_SHADOW_ALGORITHM_VERSION,
    card: next,
    dueAt: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    lastReviewAt: iso(next.last_review),
    updatedAt: now.toISOString(),
  };
}

export interface ReplayAttempt {
  questionKey: string;
  isCorrect: boolean;
  createdAt: string;
}

/** 从历史作答回放 FSRS。排序固定为 questionKey + createdAt，结果可复现。 */
export function replayFsrsShadows(attempts: readonly ReplayAttempt[]): Map<string, FsrsShadowSnapshot> {
  const grouped = new Map<string, ReplayAttempt[]>();
  for (const attempt of attempts) {
    const list = grouped.get(attempt.questionKey) ?? [];
    list.push(attempt);
    grouped.set(attempt.questionKey, list);
  }

  const result = new Map<string, FsrsShadowSnapshot>();
  for (const [questionKey, list] of grouped) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let shadow: FsrsShadowSnapshot | null = null;
    for (const attempt of list) {
      const reviewAt = new Date(attempt.createdAt);
      if (Number.isNaN(reviewAt.getTime())) continue;
      shadow = advanceFsrsShadow(shadow, attempt.isCorrect, reviewAt);
    }
    if (shadow) result.set(questionKey, shadow);
  }
  return result;
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? null;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function evaluateFsrsShadow(input: {
  cards: ReadonlyArray<{ questionKey: string; sm2DueAt: string }>;
  shadows: ReadonlyMap<string, FsrsShadowSnapshot>;
  source: "stored_shadow" | "replayed_attempts";
  now: Date;
}): LearningSchedulerEvaluation {
  const horizonsDays = [7, 14, 30] as const;
  const horizonCounts = horizonsDays.map<LearningSchedulerHorizon>((days) => ({
    days,
    sm2DueCount: 0,
    fsrsDueCount: 0,
    overlapCount: 0,
    sm2OnlyCount: 0,
    fsrsOnlyCount: 0,
  }));
  const differences: number[] = [];
  const stateCounts = { new: 0, learning: 0, review: 0, relearning: 0 };

  for (const card of input.cards) {
    const shadow = input.shadows.get(card.questionKey);
    if (!shadow) continue;
    const sm2Due = Date.parse(card.sm2DueAt);
    const fsrsDue = Date.parse(shadow.dueAt);
    if (Number.isFinite(sm2Due) && Number.isFinite(fsrsDue)) {
      differences.push(Math.abs(fsrsDue - sm2Due) / 86_400_000);
    }
    if (shadow.card.state === State.New) stateCounts.new += 1;
    else if (shadow.card.state === State.Learning) stateCounts.learning += 1;
    else if (shadow.card.state === State.Review) stateCounts.review += 1;
    else if (shadow.card.state === State.Relearning) stateCounts.relearning += 1;

    for (const horizon of horizonCounts) {
      const limit = input.now.getTime() + horizon.days * 86_400_000;
      const sm2 = Number.isFinite(sm2Due) && sm2Due <= limit;
      const next = Number.isFinite(fsrsDue) && fsrsDue <= limit;
      if (sm2) horizon.sm2DueCount += 1;
      if (next) horizon.fsrsDueCount += 1;
      if (sm2 && next) horizon.overlapCount += 1;
      if (sm2 && !next) horizon.sm2OnlyCount += 1;
      if (!sm2 && next) horizon.fsrsOnlyCount += 1;
    }
  }

  const sampleCount = input.cards.length;
  const shadowedCount = input.cards.filter((card) => input.shadows.has(card.questionKey)).length;
  const mean = differences.length
    ? differences.reduce((sum, value) => sum + value, 0) / differences.length
    : null;
  const p90 = percentile(differences, 0.9);
  return {
    algorithmVersion: FSRS_SHADOW_ALGORITHM_VERSION,
    source: input.source,
    generatedAt: input.now.toISOString(),
    sampleCount,
    shadowedCount,
    coverage: sampleCount === 0 ? 0 : round(shadowedCount / sampleCount, 4),
    meanAbsoluteDueDayDiff: mean === null ? null : round(mean),
    p90AbsoluteDueDayDiff: p90 === null ? null : round(p90),
    horizons: horizonCounts,
    stateCounts,
  };
}
