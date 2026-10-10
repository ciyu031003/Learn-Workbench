import { pgPool } from "@/lib/db";
import { QUESTION_STATUSES, QUESTION_STATUS_LABEL, isQuestionStatus, type QuestionStatus } from "@/lib/question-status";

/**
 * 题目生命周期（组二 · 阶段 12 剩余）。
 *
 * 数据在 `learning_questions`（迁移 067），由内容同步登记；这里只做读/改。
 * 状态机：draft（草稿）→ review（待审）→ published（已发布）→ archived（已下线）。
 * 允许回退（review → draft、archived → published 重新上架）。
 */

export { QUESTION_STATUSES, QUESTION_STATUS_LABEL, isQuestionStatus, type QuestionStatus };

export interface QuestionStatusRow {
  key: string;
  status: QuestionStatus;
  trackSlug: string;
  stageKey: string;
  topicKey: string | null;
}

/** 读取全部题目状态（前端题库据此叠「非已发布」角标）。库不可用由调用方兜底。 */
export async function listQuestionStatuses(): Promise<QuestionStatusRow[]> {
  const { rows } = await pgPool.query<{
    key: string;
    status: string;
    track_slug: string;
    stage_key: string;
    topic_key: string | null;
  }>(`SELECT key, status, track_slug, stage_key, topic_key FROM learning_questions`);
  return rows.map((row) => ({
    key: String(row.key),
    status: isQuestionStatus(row.status) ? row.status : "published",
    trackSlug: String(row.track_slug),
    stageKey: String(row.stage_key),
    topicKey: row.topic_key ? String(row.topic_key) : null,
  }));
}

/** 状态计数（给内容看板/门禁用）。 */
export async function questionStatusCounts(): Promise<Record<QuestionStatus, number>> {
  const counts: Record<QuestionStatus, number> = { draft: 0, review: 0, published: 0, archived: 0 };
  const { rows } = await pgPool.query<{ status: string; n: number }>(
    `SELECT status, count(*)::int AS n FROM learning_questions GROUP BY status`
  );
  for (const row of rows) if (isQuestionStatus(row.status)) counts[row.status] = Number(row.n);
  return counts;
}

/** 改一道题的状态。返回 false 表示题目不存在（调用方按 404 处理）。 */
export async function setQuestionStatus(key: string, status: QuestionStatus): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    `UPDATE learning_questions SET status = $2, updated_at = now() WHERE key = $1`,
    [key, status]
  );
  return (rowCount ?? 0) > 0;
}
