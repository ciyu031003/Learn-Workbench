import { pgPool } from "@/lib/db";
import type {
  InterviewAttempt,
  InterviewAttemptInput,
  InterviewMode,
  InterviewQuestion,
  InterviewStats,
} from "@learn-workbench/shared";
import { interviewModeSchema } from "@learn-workbench/shared";

/** 答案归一化：小写 + 去空白/标点，用于宽松判分 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s，。,.、；;：:！!？?（）()「」『』"'“”‘’\-_]/g, "");
}

/** 宽松判分：归一化后双向包含即视为命中（参考答案为文本时的启发式） */
function judge(chosen: string, answer: string): boolean {
  const c = normalize(chosen);
  const a = normalize(answer);
  if (!c || !a) return false;
  return a.includes(c) || c.includes(a);
}

function rowToAttempt(r: Record<string, unknown>): InterviewAttempt {
  return {
    id: Number(r.id),
    questionId: r.question_id == null ? null : Number(r.question_id),
    applicationId: r.application_id == null ? null : Number(r.application_id),
    phaseId: r.phase_id == null ? null : Number(r.phase_id),
    mode: (interviewModeSchema.safeParse(r.mode).data ?? "quiz") as InterviewMode,
    selfRating: r.self_rating == null ? null : Number(r.self_rating),
    reaction: r.reaction == null ? null : Number(r.reaction),
    chosenAnswer: String(r.chosen_answer ?? ""),
    isCorrect: r.is_correct == null ? null : Boolean(r.is_correct),
    note: String(r.note ?? ""),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    question: r.question == null ? null : String(r.question),
    module: r.module == null ? null : String(r.module),
    jobTitle: r.job_title == null ? null : String(r.job_title),
  };
}

/** 题库（共享，无 user_id）：按 module / difficulty 筛选，列表不含答案 */
export async function listQuestions(opts: { module?: string; difficulty?: string } = {}): Promise<InterviewQuestion[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (opts.module) {
    params.push(opts.module);
    conds.push(`module = $${params.length}`);
  }
  if (opts.difficulty) {
    params.push(opts.difficulty);
    conds.push(`difficulty = $${params.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const { rows } = await pgPool.query(
    `SELECT id, module, question, difficulty FROM interview_questions ${where} ORDER BY module, id`,
    params
  );
  return rows.map((r) => ({
    id: Number(r.id),
    module: String(r.module),
    question: String(r.question),
    difficulty: (interviewQuestionDifficulty(r.difficulty)),
  }));
}

function interviewQuestionDifficulty(d: unknown): InterviewQuestion["difficulty"] {
  const s = ["easy", "medium", "hard"];
  return (s.includes(String(d)) ? String(d) : "medium") as InterviewQuestion["difficulty"];
}

/** 题库按 module 分组计数 */
export async function listQuestionModules(): Promise<{ module: string; count: number }[]> {
  const { rows } = await pgPool.query<{ module: string; n: number }>(
    "SELECT module, count(*)::int AS n FROM interview_questions GROUP BY module ORDER BY module"
  );
  return rows.map((r) => ({ module: String(r.module), count: Number(r.n) }));
}

/** 提交一道作答 → 写 interview_attempts，返回对错 + 参考答案 */
export async function createAttempt(
  userId: string,
  input: InterviewAttemptInput
): Promise<{ attempt: InterviewAttempt; isCorrect: boolean | null; answer: string }> {
  let isCorrect: boolean | null = null;
  let answer = "";
  if (input.questionId != null) {
    const { rows } = await pgPool.query<{ answer: string | null }>(
      "SELECT answer FROM interview_questions WHERE id = $1",
      [input.questionId]
    );
    const q = rows[0];
    if (q) {
      answer = q.answer ?? "";
      if (typeof input.chosenAnswer === "string" && input.chosenAnswer.trim()) {
        isCorrect = judge(input.chosenAnswer, answer);
      }
    }
  }
  const mode = interviewModeSchema.parse(input.mode ?? "quiz");
  const { rows } = await pgPool.query(
    `INSERT INTO interview_attempts
       (user_id, question_id, application_id, phase_id, mode, self_rating, reaction, chosen_answer, is_correct, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, question_id, application_id, phase_id, mode, self_rating, reaction,
               chosen_answer, is_correct, note, created_at, updated_at`,
    [
      userId,
      input.questionId ?? null,
      input.applicationId ?? null,
      input.phaseId ?? null,
      mode,
      input.selfRating ?? null,
      input.reaction ?? null,
      input.chosenAnswer ?? "",
      isCorrect,
      input.note ?? "",
    ]
  );
  const attempt = await attemptDetail(userId, rows[0]);
  return { attempt, isCorrect, answer };
}

/** 单条记录补关联信息（题目文本 / module / 关联职位） */
async function attemptDetail(userId: string, r: Record<string, unknown>): Promise<InterviewAttempt> {
  const { rows } = await pgPool.query(
    `SELECT a.id, a.question_id, a.application_id, a.phase_id, a.mode, a.self_rating, a.reaction,
            a.chosen_answer, a.is_correct, a.note, a.created_at, a.updated_at,
            q.question, q.module, j.title AS job_title
       FROM interview_attempts a
       LEFT JOIN interview_questions q ON q.id = a.question_id
       LEFT JOIN job_applications app ON app.id = a.application_id
       LEFT JOIN job_postings j ON j.id = app.job_id
      WHERE a.user_id = $1 AND a.id = $2`,
    [userId, r.id]
  );
  return rowToAttempt(rows[0] as Record<string, unknown>);
}

/** 我的答题 / 面试记录（按时间倒序） */
export async function listAttempts(userId: string): Promise<InterviewAttempt[]> {
  const { rows } = await pgPool.query(
    `SELECT a.id, a.question_id, a.application_id, a.phase_id, a.mode, a.self_rating, a.reaction,
            a.chosen_answer, a.is_correct, a.note, a.created_at, a.updated_at,
            q.question, q.module, j.title AS job_title
       FROM interview_attempts a
       LEFT JOIN interview_questions q ON q.id = a.question_id
       LEFT JOIN job_applications app ON app.id = a.application_id
       LEFT JOIN job_postings j ON j.id = app.job_id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
      LIMIT 200`,
    [userId]
  );
  return rows.map((r) => rowToAttempt(r as Record<string, unknown>));
}

/** 该用户在某阶段是否有面试记录（用于 Kanban 回流提示） */
export async function attemptCountForApplication(userId: string, applicationId: number): Promise<number> {
  const { rows } = await pgPool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM interview_attempts WHERE user_id = $1 AND application_id = $2",
    [userId, applicationId]
  );
  return rows[0]?.n ?? 0;
}

/** 答题统计（总分 + 按 module 汇总） */
export async function interviewStats(userId: string): Promise<InterviewStats> {
  const { rows } = await pgPool.query<{ total: number; correct: number; interviewCount: number; avgRating: number | null }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE is_correct)::int AS correct,
            count(*) FILTER (WHERE mode = 'interview')::int AS interview_count,
            avg(self_rating)::float AS avg_rating
       FROM interview_attempts WHERE user_id = $1`,
    [userId]
  );
  const agg = rows[0] ?? { total: 0, correct: 0, interviewCount: 0, avgRating: null };
  const { rows: moduleRows } = await pgPool.query<{ module: string; total: number; correct: number }>(
    `SELECT COALESCE(q.module, '自由') AS module,
            count(*)::int AS total,
            count(*) FILTER (WHERE a.is_correct)::int AS correct
       FROM interview_attempts a
       LEFT JOIN interview_questions q ON q.id = a.question_id
      WHERE a.user_id = $1
      GROUP BY 1 ORDER BY 1`,
    [userId]
  );
  return {
    total: Number(agg.total ?? 0),
    correct: Number(agg.correct ?? 0),
    interviewCount: Number(agg.interviewCount ?? 0),
    avgRating: agg.avgRating == null ? null : Number(agg.avgRating),
    byModule: moduleRows.map((r) => ({
      module: String(r.module),
      total: Number(r.total),
      correct: Number(r.correct),
    })),
  };
}
