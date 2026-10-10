import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { LearningReviewResponse } from "@learn-workbench/shared";

const EMPTY: LearningReviewResponse = { cards: [], dueCount: 0, totalCount: 0, masteredCount: 0 };

/**
 * 拉取服务端到期复习队列（SM-2 卡片，`/api/learning/review`）。
 *
 * 返回 `null` 表示**没拿到权威答案**（未登录 / 网络或服务端失败）——
 * 调用方据此回退到本地错题，而不是把复习入口清空。
 */
export async function fetchLearningReview(): Promise<LearningReviewResponse | null> {
  const token = useAppStore.getState().token;
  if (!token) return null;
  try {
    const response = await fetch(getApiUrl() + "/api/learning/review", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<LearningReviewResponse> | null;
    if (!data || !Array.isArray(data.cards)) return null;
    return {
      cards: data.cards,
      dueCount: typeof data.dueCount === "number" ? data.dueCount : data.cards.length,
      totalCount: typeof data.totalCount === "number" ? data.totalCount : data.cards.length,
      masteredCount: typeof data.masteredCount === "number" ? data.masteredCount : 0,
    };
  } catch {
    return null;
  }
}

/** 到期复习的题目 key（按方向过滤），供答题会话复用；拿不到时返回空数组 */
export async function fetchDueReviewKeys(trackSlug?: string): Promise<string[]> {
  const review = await fetchLearningReview();
  if (!review) return [];
  return review.cards
    .filter((card) => !trackSlug || card.trackSlug === trackSlug)
    .map((card) => card.questionKey);
}

export const EMPTY_REVIEW = EMPTY;
