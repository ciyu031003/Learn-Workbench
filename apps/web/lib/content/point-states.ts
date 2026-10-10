import {
  getLearningTrack,
  isLearnable,
  knowledgePointKeyOf,
  qualityOfTopic,
} from "@learn-workbench/content";
import { pgPool } from "@/lib/db";
import { learningLibraryState } from "@/lib/learning-read";
import { learningReviewQueue } from "@/lib/learning";
import { derivePointState, type PointStateResult } from "@/lib/learning-states";

/**
 * 知识点状态五件套的数据组装（组二 · 阶段 13 = V3 Phase E）。
 *
 * 三个真实来源：
 *   - 阅读 / 收藏：`learning_read_state` / `learning_favorites`（阶段 8 已落库）；
 *   - 练习 / 掌握：`learning_attempts` 里每道题的**最近一次**对错；
 *   - 复习：`learning_review_cards` 的到期卡片（SM-2 状态机）。
 * 判定逻辑在 `lib/learning-states.ts`（纯函数），这里只负责把数据取齐。
 */

export interface TrackPointStates {
  trackSlug: string;
  /** pointKey → 五状态 */
  points: Record<string, PointStateResult>;
}

export async function pointStatesForTrack(userId: string, trackSlug: string): Promise<TrackPointStates | null> {
  const track = getLearningTrack(trackSlug);
  if (!track) return null;

  const [library, review, attempts] = await Promise.all([
    learningLibraryState(userId, trackSlug),
    learningReviewQueue(userId).catch(() => ({ cards: [], dueCount: 0, totalCount: 0, masteredCount: 0 })),
    pgPool.query<{ question_key: string; is_correct: boolean }>(
      `SELECT DISTINCT ON (question_key) question_key, is_correct
         FROM learning_attempts
        WHERE user_id = $1 AND track_slug = $2
        ORDER BY question_key, created_at DESC`,
      [userId, trackSlug]
    ),
  ]);

  const readProgress = new Map(library.read.map((state) => [state.pointKey, state.progress]));
  const favorites = new Set(library.favorites.map((favorite) => favorite.pointKey));
  const latestCorrect = new Map(attempts.rows.map((row) => [String(row.question_key), Boolean(row.is_correct)]));
  const dueQuestions = new Set(review.cards.map((card) => card.questionKey));

  const points: Record<string, PointStateResult> = {};
  for (const stage of track.stages) {
    for (const topic of stage.topics) {
      if (!isLearnable(qualityOfTopic(track, stage, topic).level)) continue;
      const pointKey = knowledgePointKeyOf({ trackSlug: track.slug, stageKey: stage.key, topicKey: topic.key });
      const questions = track.questions.filter((question) => question.topicKey === topic.key);
      points[pointKey] = derivePointState({
        readProgress: readProgress.get(pointKey),
        latestCorrect: questions
          .map((question) => latestCorrect.get(question.key))
          .filter((value): value is boolean => value !== undefined),
        dueForReview: questions.some((question) => dueQuestions.has(question.key)),
        favorite: favorites.has(pointKey),
      });
    }
  }
  return { trackSlug: track.slug, points };
}

/**
 * 内容时效（组二 · 阶段 14 = V3 Phase G）：`knowledge_points.stale_after` 已过期的知识点 key。
 * 公开可读（内容新鲜度不是隐私）；库不可用返回空数组，不阻断页面。
 */
export async function stalePointKeys(trackSlug?: string): Promise<string[]> {
  const params: unknown[] = [];
  let where = "WHERE status = 'published' AND stale_after IS NOT NULL AND stale_after < now()";
  if (trackSlug) {
    params.push(trackSlug);
    where += ` AND track_slug = $${params.length}`;
  }
  const { rows } = await pgPool.query<{ key: string }>(`SELECT key FROM knowledge_points ${where}`, params);
  return rows.map((row) => String(row.key));
}
