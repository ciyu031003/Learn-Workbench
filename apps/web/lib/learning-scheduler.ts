import {
  type LearningSchedulerActionInput,
  type LearningSchedulerEvaluation,
  type LearningSchedulerMode,
  type LearningSchedulerResponse,
} from "@learn-workbench/shared";
import { pgPool } from "@/lib/db";
import {
  evaluateFsrsShadow,
  replayFsrsShadows,
  type FsrsShadowSnapshot,
} from "@/lib/fsrs-shadow";

interface SchedulerSettingRow {
  track_slug: string;
  mode: LearningSchedulerMode;
}

export type SchedulerSettingQuery = (
  sql: string,
  values?: unknown[]
) => Promise<{ rows: Array<Record<string, unknown>> }>;

interface AttemptReplayRow {
  question_key: string;
  is_correct: boolean;
  created_at: string;
}

interface EvaluationCardRow {
  question_key: string;
  due_at: string;
  fsrs_state: unknown;
  fsrs_due_at: string | null;
  fsrs_stability: string | number | null;
  fsrs_difficulty: string | number | null;
  fsrs_last_review_at: string | null;
  fsrs_updated_at: string | null;
}

function storedShadow(row: EvaluationCardRow): FsrsShadowSnapshot | null {
  if (!row.fsrs_state || !row.fsrs_due_at) return null;
  return {
    algorithmVersion: "stored",
    card: row.fsrs_state as FsrsShadowSnapshot["card"],
    dueAt: new Date(row.fsrs_due_at).toISOString(),
    stability: Number(row.fsrs_stability) || 0,
    difficulty: Number(row.fsrs_difficulty) || 0,
    lastReviewAt: row.fsrs_last_review_at ? new Date(row.fsrs_last_review_at).toISOString() : null,
    updatedAt: row.fsrs_updated_at ? new Date(row.fsrs_updated_at).toISOString() : new Date(0).toISOString(),
  };
}

async function effectiveMode(
  userId: string,
  trackSlug?: string
): Promise<{ mode: LearningSchedulerMode; modeSource: "track" | "global" | "default" }> {
  const params: unknown[] = [userId];
  let where = "WHERE user_id = $1 AND track_slug = '*'";
  if (trackSlug) {
    params.push(trackSlug);
    where = "WHERE user_id = $1 AND track_slug IN ('*', $2)";
  }
  const { rows } = await pgPool.query<SchedulerSettingRow>(
    `SELECT track_slug, mode
       FROM learning_scheduler_settings
       ${where}`,
    params
  );
  const track = trackSlug ? rows.find((row) => row.track_slug === trackSlug) : null;
  if (track) return { mode: track.mode, modeSource: "track" };
  const global = rows.find((row) => row.track_slug === "*");
  if (global) return { mode: global.mode, modeSource: "global" };
  return { mode: "shadow", modeSource: "default" };
}

async function evaluationFor(
  userId: string,
  trackSlug: string | undefined,
  now: Date
): Promise<LearningSchedulerEvaluation> {
  const params: unknown[] = [userId];
  let attemptWhere = "WHERE user_id = $1";
  let cardWhere = "WHERE user_id = $1 AND status IN ('learning', 'review')";
  if (trackSlug) {
    params.push(trackSlug);
    attemptWhere += ` AND track_slug = $${params.length}`;
    cardWhere += ` AND track_slug = $${params.length}`;
  }
  const [attemptsResult, cardsResult] = await Promise.all([
    pgPool.query<AttemptReplayRow>(
      `SELECT question_key, is_correct, created_at
         FROM learning_attempts
         ${attemptWhere}
        ORDER BY question_key, created_at`,
      params
    ),
    pgPool.query<EvaluationCardRow>(
      `SELECT question_key, due_at, fsrs_state, fsrs_due_at, fsrs_stability, fsrs_difficulty,
              fsrs_last_review_at, fsrs_updated_at
         FROM learning_review_cards
         ${cardWhere}
        ORDER BY question_key`,
      params
    ),
  ]);

  const replayed = replayFsrsShadows(
    attemptsResult.rows.map((row) => ({
      questionKey: String(row.question_key),
      isCorrect: Boolean(row.is_correct),
      createdAt: new Date(row.created_at).toISOString(),
    }))
  );
  const replayedCount = replayed.size;
  const stored = new Map<string, FsrsShadowSnapshot>();
  for (const row of cardsResult.rows) {
    const snapshot = storedShadow(row);
    if (snapshot) stored.set(String(row.question_key), snapshot);
  }
  // 历史作答回放优先：它包含全部作答，不受影子开关曾经关闭的影响。
  // 只有没有任何作答可回放的卡片，才回退到数据库里最后一份影子快照。
  for (const [key, value] of stored) {
    if (!replayed.has(key)) replayed.set(key, value);
  }

  return evaluateFsrsShadow({
    cards: cardsResult.rows.map((row) => ({
      questionKey: String(row.question_key),
      sm2DueAt: new Date(row.due_at).toISOString(),
    })),
    shadows: replayed,
    source: replayedCount > 0 ? "replayed_attempts" : stored.size > 0 ? "stored_shadow" : "replayed_attempts",
    now,
  });
}

export async function learningSchedulerStatus(
  userId: string,
  trackSlug?: string,
  now: Date = new Date()
): Promise<LearningSchedulerResponse> {
  const [effective, evaluation] = await Promise.all([
    effectiveMode(userId, trackSlug),
    evaluationFor(userId, trackSlug, now),
  ]);
  return {
    mode: effective.mode,
    modeSource: effective.modeSource,
    trackSlug: trackSlug ?? null,
    evaluation,
  };
}

export async function setLearningSchedulerMode(
  userId: string,
  input: LearningSchedulerActionInput,
  now: Date = new Date()
): Promise<LearningSchedulerResponse> {
  const mode: LearningSchedulerMode = input.action === "enable_shadow" ? "shadow" : "off";
  const trackSlug = input.trackSlug ?? "*";
  await pgPool.query(
    `INSERT INTO learning_scheduler_settings (user_id, track_slug, mode)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, track_slug) DO UPDATE SET
       mode = EXCLUDED.mode,
       updated_at = now()`,
    [userId, trackSlug, mode]
  );
  return learningSchedulerStatus(userId, input.trackSlug, now);
}

export async function shouldComputeFsrsShadow(
  query: SchedulerSettingQuery,
  userId: string,
  trackSlug: string
): Promise<boolean> {
  const { rows: rawRows } = await query(
    `SELECT track_slug, mode
       FROM learning_scheduler_settings
      WHERE user_id = $1 AND track_slug IN ('*', $2)`,
    [userId, trackSlug]
  );
  const rows = rawRows as unknown as SchedulerSettingRow[];
  const track = rows.find((row) => row.track_slug === trackSlug);
  if (track) return track.mode === "shadow";
  const global = rows.find((row) => row.track_slug === "*");
  return global?.mode !== "off";
}
