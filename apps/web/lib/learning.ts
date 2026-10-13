import {
  getLearningQuestion,
  getLearningTrack,
  type LearningQuestion,
  type LearningTrack,
  learningTracks,
} from "@learn-workbench/content";
import {
  applyLearningReviewAction as applyReviewAction,
  gradeLearningAnswer,
  isLearningReviewDue,
  learningDayKey,
  learningReviewAlgorithmVersion,
  scheduleLearningReview,
  summarizeLearningAttempts,
  type LearningAttemptInput,
  type LearningAttemptResult,
  type LearningProgress,
  type LearningReviewActionInput,
  type LearningReviewCard,
  type LearningReviewMutationResponse,
  type LearningReviewResponse,
  type LearningReviewScheduleState,
  type LearningReviewStatus,
  type LearningWeakTopic,
} from "@learn-workbench/shared";
import { pgPool } from "@/lib/db";
import { advanceFsrsShadow } from "@/lib/fsrs-shadow";
import { shouldComputeFsrsShadow } from "@/lib/learning-scheduler";

function grade(question: LearningQuestion, chosenAnswer: string[]): boolean {
  return gradeLearningAnswer(question.answer, chosenAnswer);
}

export function learningCatalog(): Array<LearningTrack & { questionCount: number }> {
  return learningTracks.map((track) => ({
    ...track,
    questions: track.questions.map(({ answer: _answer, explanation: _explanation, ...question }) => ({
      ...question,
      answer: [],
      explanation: "",
    })),
    questionCount: track.questions.length,
  }));
}

interface AttemptRow {
  id: string | number;
  created_at: string;
}

interface ReviewCardRow {
  question_key: string;
  track_slug: string;
  stage_key: string;
  topic_key: string | null;
  status: LearningReviewStatus;
  interval_days: number;
  ease: string | number;
  streak: number;
  lapses: number;
  due_at: string;
  last_result: boolean | null;
  algorithm_version: string;
  schedule_reason: string;
  suspended_from_status: LearningReviewStatus | null;
  updated_at: string;
  fsrs_state?: unknown;
}

function reviewCardFromRow(row: ReviewCardRow): LearningReviewCard {
  const question = getLearningQuestion(String(row.track_slug), String(row.question_key));
  return {
    questionKey: String(row.question_key),
    trackSlug: String(row.track_slug),
    stageKey: String(row.stage_key),
    topicKey: row.topic_key ?? question?.topicKey ?? null,
    status: row.status,
    intervalDays: Number(row.interval_days),
    ease: Number(row.ease),
    streak: Number(row.streak),
    lapses: Number(row.lapses),
    dueAt: new Date(row.due_at).toISOString(),
    lastResult: row.last_result === null ? null : Boolean(row.last_result),
    algorithmVersion: String(row.algorithm_version || learningReviewAlgorithmVersion),
    scheduleReason: String(row.schedule_reason || "legacy"),
    suspendedFromStatus: row.suspended_from_status ?? null,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function scheduleState(card: LearningReviewCard): LearningReviewScheduleState {
  return {
    status: card.status,
    intervalDays: card.intervalDays,
    ease: card.ease,
    streak: card.streak,
    lapses: card.lapses,
    dueAt: card.dueAt,
    suspendedFromStatus: card.suspendedFromStatus,
  };
}

export async function recordLearningAttempt(
  userId: string,
  input: LearningAttemptInput,
  now: Date = new Date()
): Promise<LearningAttemptResult> {
  const question = getLearningQuestion(input.trackSlug, input.questionKey);
  if (!question) throw new Error("学习题目不存在");
  const isCorrect = grade(question, input.chosenAnswer);
  const clientId = input.clientId ?? null;
  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");
    const inserted = await client.query<AttemptRow>(
      `INSERT INTO learning_attempts
         (user_id, track_slug, stage_key, question_key, chosen_answer, is_correct, client_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id, created_at`,
      [
        userId,
        input.trackSlug,
        question.stageKey,
        input.questionKey,
        JSON.stringify(input.chosenAnswer),
        isCorrect,
        clientId,
      ]
    );

    if (clientId && inserted.rows.length === 0) {
      const existing = await client.query<AttemptRow>(
        `SELECT id, created_at
           FROM learning_attempts
          WHERE user_id = $1 AND client_id = $2`,
        [userId, clientId]
      );
      await client.query("COMMIT");
      return {
        questionKey: question.key,
        trackSlug: input.trackSlug,
        stageKey: question.stageKey,
        isCorrect,
        answer: question.answer,
        explanation: question.explanation,
        createdAt: new Date(existing.rows[0]?.created_at ?? now).toISOString(),
      };
    }

    const attempt = inserted.rows[0];
    await client.query(
      `INSERT INTO learning_review_cards
         (user_id, question_key, track_slug, stage_key, topic_key, status, interval_days, ease,
          streak, lapses, due_at, last_result, algorithm_version, schedule_reason)
       VALUES ($1, $2, $3, $4, $5, 'learning', 0, 2.50, 0, 0, $6, NULL, $7, 'initial')
       ON CONFLICT (user_id, question_key) DO NOTHING`,
      [
        userId,
        input.questionKey,
        input.trackSlug,
        question.stageKey,
        question.topicKey ?? null,
        now.toISOString(),
        learningReviewAlgorithmVersion,
      ]
    );
    const cardResult = await client.query<ReviewCardRow>(
      `SELECT question_key, track_slug, stage_key, topic_key, status, interval_days, ease, streak,
              lapses, due_at, last_result, algorithm_version, schedule_reason,
              suspended_from_status, updated_at, fsrs_state
         FROM learning_review_cards
        WHERE user_id = $1 AND question_key = $2
        FOR UPDATE`,
      [userId, input.questionKey]
    );
    const current = reviewCardFromRow(cardResult.rows[0]);
    const next = scheduleLearningReview({ state: scheduleState(current), isCorrect, now });
    const shadowEnabled = await shouldComputeFsrsShadow(
      (sql, values) => client.query(sql, values),
      userId,
      input.trackSlug
    );
    const shadow = shadowEnabled
      ? advanceFsrsShadow(cardResult.rows[0]?.fsrs_state ?? null, isCorrect, now)
      : null;
    await client.query(
      `UPDATE learning_review_cards
          SET track_slug = $3,
              stage_key = $4,
              topic_key = $5,
              status = $6,
              interval_days = $7,
              ease = $8,
              streak = $9,
              lapses = $10,
              due_at = $11,
              last_result = $12,
              algorithm_version = $13,
              schedule_reason = $14,
              suspended_from_status = NULL,
              suspended_at = NULL,
              completed_at = $15,
              last_attempt_id = $16,
              fsrs_state = CASE WHEN $17 THEN $18::jsonb ELSE fsrs_state END,
              fsrs_due_at = CASE WHEN $17 THEN $19::timestamptz ELSE fsrs_due_at END,
              fsrs_stability = CASE WHEN $17 THEN $20::numeric ELSE fsrs_stability END,
              fsrs_difficulty = CASE WHEN $17 THEN $21::numeric ELSE fsrs_difficulty END,
              fsrs_last_review_at = CASE WHEN $17 THEN $22::timestamptz ELSE fsrs_last_review_at END,
              fsrs_updated_at = CASE WHEN $17 THEN $23::timestamptz ELSE fsrs_updated_at END,
              updated_at = now()
        WHERE user_id = $1 AND question_key = $2`,
      [
        userId,
        input.questionKey,
        input.trackSlug,
        question.stageKey,
        question.topicKey ?? null,
        next.status,
        next.intervalDays,
        next.ease,
        next.streak,
        next.lapses,
        next.dueAt,
        isCorrect,
        next.algorithmVersion,
        next.scheduleReason,
        next.completedAt,
        attempt.id,
        shadow !== null,
        shadow ? JSON.stringify(shadow.card) : null,
        shadow?.dueAt ?? null,
        shadow?.stability ?? null,
        shadow?.difficulty ?? null,
        shadow?.lastReviewAt ?? null,
        shadow?.updatedAt ?? null,
      ]
    );
    await client.query("COMMIT");

    return {
      questionKey: question.key,
      trackSlug: input.trackSlug,
      stageKey: question.stageKey,
      isCorrect,
      answer: question.answer,
      explanation: question.explanation,
      createdAt: new Date(attempt.created_at ?? now).toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function learningProgress(
  userId: string,
  trackSlug?: string,
  now: Date = new Date(),
  timeZone?: string
): Promise<LearningProgress> {
  const params: unknown[] = [userId];
  let where = "WHERE user_id = $1";
  if (trackSlug) {
    params.push(trackSlug);
    where += ` AND track_slug = $${params.length}`;
  }
  const { rows } = await pgPool.query(
    `SELECT DISTINCT ON (question_key)
            question_key, track_slug, stage_key, is_correct, created_at
       FROM learning_attempts
       ${where}
      ORDER BY question_key, created_at DESC`,
    params
  );
  const latest = rows.map((row) => ({
    questionKey: String(row.question_key),
    trackSlug: String(row.track_slug),
    stageKey: String(row.stage_key),
    isCorrect: Boolean(row.is_correct),
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
  const summary = summarizeLearningAttempts(latest, {
    todayKey: learningDayKey(now.toISOString(), timeZone),
    dayKey: (iso) => learningDayKey(iso, timeZone),
    now,
  });
  const { rows: recentRows } = await pgPool.query(
    `SELECT question_key, track_slug, stage_key, is_correct, created_at
       FROM learning_attempts
       ${where}
      ORDER BY created_at DESC
      LIMIT 20`,
    params
  );
  return {
    attempted: summary.attempted,
    correct: summary.correct,
    wrong: summary.wrong,
    mastery: summary.mastery,
    masteryBasis: summary.masteryBasis,
    today: summary.today,
    recent: recentRows.map((row) => {
      const question = getLearningQuestion(String(row.track_slug), String(row.question_key));
      return {
        questionKey: String(row.question_key),
        trackSlug: String(row.track_slug),
        stageKey: String(row.stage_key),
        isCorrect: Boolean(row.is_correct),
        createdAt: new Date(row.created_at as string).toISOString(),
        answer: question?.answer ?? [],
        explanation: question?.explanation ?? "",
      };
    }),
  };
}

function weakTopicsFromCards(cards: LearningReviewCard[], now: Date): LearningWeakTopic[] {
  const grouped = new Map<string, LearningWeakTopic>();
  for (const card of cards) {
    if (!card.topicKey || card.status === "mastered" || card.status === "suspended") continue;
    const due = isLearningReviewDue(card, now);
    const wrong = card.lastResult === false || card.lapses > 0;
    if (!due && !wrong) continue;
    const key = `${card.trackSlug}\u0000${card.stageKey}\u0000${card.topicKey}`;
    const current = grouped.get(key) ?? {
      trackSlug: card.trackSlug,
      stageKey: card.stageKey,
      topicKey: card.topicKey,
      title: card.topicKey,
      dueCount: 0,
      wrongCount: 0,
    };
    current.dueCount += due ? 1 : 0;
    current.wrongCount += wrong ? 1 : 0;
    const track = getLearningTrack(card.trackSlug);
    const stage = track?.stages.find((item) => item.key === card.stageKey);
    current.title = stage?.topics.find((item) => item.key === card.topicKey)?.title ?? current.title;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort(
    (a, b) =>
      b.dueCount - a.dueCount ||
      b.wrongCount - a.wrongCount ||
      a.trackSlug.localeCompare(b.trackSlug) ||
      a.stageKey.localeCompare(b.stageKey) ||
      a.topicKey.localeCompare(b.topicKey)
  );
}

export async function learningReviewQueue(
  userId: string,
  now: Date = new Date(),
  scope: "due" | "all" = "due"
): Promise<LearningReviewResponse> {
  const { rows } = await pgPool.query<ReviewCardRow>(
    `SELECT question_key, track_slug, stage_key, topic_key, status, interval_days, ease, streak,
            lapses, due_at, last_result, algorithm_version, schedule_reason,
            suspended_from_status, updated_at
       FROM learning_review_cards
      WHERE user_id = $1
      ORDER BY
        CASE WHEN status = 'suspended' THEN 1 WHEN status = 'mastered' THEN 2 ELSE 0 END,
        due_at ASC,
        question_key ASC`,
    [userId]
  );
  const allCards = rows.map(reviewCardFromRow);
  const dueCards = allCards.filter((card) => isLearningReviewDue(card, now));
  return {
    cards: scope === "all" ? allCards : dueCards,
    weakTopics: weakTopicsFromCards(allCards, now),
    dueCount: dueCards.length,
    totalCount: allCards.length,
    masteredCount: allCards.filter((card) => card.status === "mastered").length,
    suspendedCount: allCards.filter((card) => card.status === "suspended").length,
    generatedAt: now.toISOString(),
  };
}

export async function mutateLearningReview(
  userId: string,
  input: LearningReviewActionInput,
  now: Date = new Date()
): Promise<LearningReviewMutationResponse> {
  const questionKeys = [...new Set(input.questionKeys)];
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const event = await client.query<{ id: string }>(
      `INSERT INTO learning_review_events
         (user_id, client_id, action, question_keys, payload)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       ON CONFLICT (user_id, client_id) DO NOTHING
       RETURNING id`,
      [
        userId,
        input.clientId,
        input.action,
        JSON.stringify(questionKeys),
        JSON.stringify({ snoozeDays: input.snoozeDays, snoozeUntil: input.snoozeUntil }),
      ]
    );
    if (event.rows.length === 0) {
      await client.query("COMMIT");
      const queue = await learningReviewQueue(userId, now, "all");
      return { ...queue, applied: 0, duplicate: true };
    }

    const result = await client.query<ReviewCardRow>(
      `SELECT question_key, track_slug, stage_key, topic_key, status, interval_days, ease, streak,
              lapses, due_at, last_result, algorithm_version, schedule_reason,
              suspended_from_status, updated_at
         FROM learning_review_cards
        WHERE user_id = $1 AND question_key = ANY($2::text[])
        FOR UPDATE`,
      [userId, questionKeys]
    );
    let applied = 0;
    for (const row of result.rows) {
      const current = reviewCardFromRow(row);
      const next = applyReviewAction({
        card: current,
        action: input.action,
        now,
        snoozeDays: input.snoozeDays,
        snoozeUntil: input.snoozeUntil,
      });
      if (next === current) continue;
      await client.query(
        `UPDATE learning_review_cards
            SET status = $3,
                due_at = $4,
                schedule_reason = $5,
                suspended_from_status = $6,
                suspended_at = CASE WHEN $3 = 'suspended' THEN $7 ELSE NULL END,
                completed_at = CASE WHEN $3 = 'mastered' THEN $7 ELSE completed_at END,
                updated_at = now()
          WHERE user_id = $1 AND question_key = $2`,
        [
          userId,
          current.questionKey,
          next.status,
          next.dueAt,
          next.scheduleReason,
          next.suspendedFromStatus,
          now.toISOString(),
        ]
      );
      applied += 1;
    }
    await client.query(`UPDATE learning_review_events SET applied_count = $2 WHERE id = $1`, [
      event.rows[0].id,
      applied,
    ]);
    await client.query("COMMIT");
    const queue = await learningReviewQueue(userId, now, "all");
    return { ...queue, applied, duplicate: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
