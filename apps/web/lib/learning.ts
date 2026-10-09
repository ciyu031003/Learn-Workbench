import { getLearningQuestion, type LearningQuestion, type LearningTrack, learningTracks } from "@learn-workbench/content";
import type { LearningAttemptInput, LearningAttemptResult, LearningProgress } from "@learn-workbench/shared";
import { pgPool } from "@/lib/db";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function grade(question: LearningQuestion, chosenAnswer: string[]): boolean {
  const expected = [...new Set(question.answer.map(normalize))].sort();
  const chosen = [...new Set(chosenAnswer.map(normalize))].sort();
  return chosen.length === expected.length && chosen.every((value, index) => value === expected[index]);
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

export async function recordLearningAttempt(userId: string, input: LearningAttemptInput): Promise<LearningAttemptResult> {
  const question = getLearningQuestion(input.trackSlug, input.questionKey);
  if (!question) throw new Error("学习题目不存在");
  const isCorrect = grade(question, input.chosenAnswer);
  const { rows } = await pgPool.query<{ created_at: string }>(
    `INSERT INTO learning_attempts
       (user_id, track_slug, stage_key, question_key, chosen_answer, is_correct)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING created_at`,
    [userId, input.trackSlug, question.stageKey, input.questionKey, JSON.stringify(input.chosenAnswer), isCorrect]
  );

  await pgPool.query(
    `INSERT INTO learning_review_cards
       (user_id, question_key, track_slug, stage_key, status, interval_days, ease, streak, lapses, due_at, last_result)
     VALUES
       ($1, $2, $3, $4, 'learning', 0, 2.5, 0, 0, now(), $5)
     ON CONFLICT (user_id, question_key) DO UPDATE SET
       track_slug = EXCLUDED.track_slug,
       stage_key = EXCLUDED.stage_key,
       status = CASE
         WHEN $5 AND learning_review_cards.streak + 1 >= 4 THEN 'mastered'
         WHEN $5 THEN 'review'
         ELSE 'learning'
       END,
       interval_days = CASE
         WHEN NOT $5 THEN 1
         WHEN learning_review_cards.interval_days = 0 THEN 1
         WHEN learning_review_cards.interval_days = 1 THEN 3
         WHEN learning_review_cards.interval_days = 3 THEN 7
         ELSE LEAST(60, GREATEST(7, ROUND(learning_review_cards.interval_days * learning_review_cards.ease)::int))
       END,
       ease = CASE
         WHEN $5 THEN LEAST(3.50, learning_review_cards.ease + 0.05)
         ELSE GREATEST(1.30, learning_review_cards.ease - 0.20)
       END,
       streak = CASE WHEN $5 THEN learning_review_cards.streak + 1 ELSE 0 END,
       lapses = CASE WHEN $5 THEN learning_review_cards.lapses ELSE learning_review_cards.lapses + 1 END,
       due_at = now() + (
         CASE
           WHEN NOT $5 THEN 1
           WHEN learning_review_cards.interval_days = 0 THEN 1
           WHEN learning_review_cards.interval_days = 1 THEN 3
           WHEN learning_review_cards.interval_days = 3 THEN 7
           ELSE LEAST(60, GREATEST(7, ROUND(learning_review_cards.interval_days * learning_review_cards.ease)::int))
         END || ' days'
       )::interval,
       last_result = EXCLUDED.last_result,
       updated_at = now()`,
    [userId, input.questionKey, input.trackSlug, question.stageKey, isCorrect]
  );

  return {
    questionKey: question.key,
    trackSlug: input.trackSlug,
    stageKey: question.stageKey,
    isCorrect,
    answer: question.answer,
    explanation: question.explanation,
    createdAt: new Date(rows[0]?.created_at ?? Date.now()).toISOString(),
  };
}

export async function learningProgress(userId: string, trackSlug?: string): Promise<LearningProgress> {
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
  const correct = latest.filter((attempt) => attempt.isCorrect).length;
  const wrong = latest.length - correct;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = latest.filter((attempt) => attempt.createdAt.slice(0, 10) === today).length;
  const { rows: recentRows } = await pgPool.query(
    `SELECT question_key, track_slug, stage_key, is_correct, created_at
       FROM learning_attempts
       ${where}
      ORDER BY created_at DESC
      LIMIT 20`,
    params
  );
  return {
    attempted: latest.length,
    correct,
    wrong,
    mastery: latest.length === 0 ? 0 : Math.round((correct / latest.length) * 100),
    today: todayCount,
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
