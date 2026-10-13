import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  LearningReviewActionInput,
  LearningReviewMutationResponse,
  LearningReviewResponse,
} from "@learn-workbench/shared";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";

const ACTION_QUEUE_KEY = "lwb-learning-review-actions-v1";

export const EMPTY_REVIEW: LearningReviewResponse = {
  cards: [],
  weakTopics: [],
  dueCount: 0,
  totalCount: 0,
  masteredCount: 0,
  suspendedCount: 0,
  generatedAt: new Date(0).toISOString(),
};

function normalizeReview(data: Partial<LearningReviewResponse> | null): LearningReviewResponse | null {
  if (!data || !Array.isArray(data.cards)) return null;
  return {
    cards: data.cards,
    weakTopics: Array.isArray(data.weakTopics) ? data.weakTopics : [],
    dueCount: typeof data.dueCount === "number" ? data.dueCount : data.cards.length,
    totalCount: typeof data.totalCount === "number" ? data.totalCount : data.cards.length,
    masteredCount: typeof data.masteredCount === "number" ? data.masteredCount : 0,
    suspendedCount: typeof data.suspendedCount === "number" ? data.suspendedCount : 0,
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : new Date().toISOString(),
  };
}

function authHeaders(token: string, json = false): Record<string, string> {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}

/** 拉取服务端复习计划；默认只拿到期卡，scope=all 用于管理。 */
export async function fetchLearningReview(scope: "due" | "all" = "due"): Promise<LearningReviewResponse | null> {
  const token = useAppStore.getState().token;
  if (!token) return null;
  try {
    const response = await fetch(`${getApiUrl()}/api/learning/review?scope=${scope}`, {
      headers: authHeaders(token),
    });
    if (!response.ok) return null;
    return normalizeReview((await response.json()) as Partial<LearningReviewResponse> | null);
  } catch {
    return null;
  }
}

/** 到期复习的题目 key（按方向过滤），拿不到时返回空数组。 */
export async function fetchDueReviewKeys(trackSlug?: string): Promise<string[]> {
  const review = await fetchLearningReview("due");
  if (!review) return [];
  return review.cards
    .filter((card) => !trackSlug || card.trackSlug === trackSlug)
    .map((card) => card.questionKey);
}

function makeClientId(): string {
  return `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface QueuedReviewAction extends LearningReviewActionInput {
  queuedAt: string;
}

async function readQueue(): Promise<QueuedReviewAction[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isQueuedAction) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedReviewAction[]): Promise<void> {
  await AsyncStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(queue.slice(-200)));
}

function isQueuedAction(value: unknown): value is QueuedReviewAction {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<QueuedReviewAction>;
  return (
    typeof item.action === "string" &&
    Array.isArray(item.questionKeys) &&
    item.questionKeys.every((key) => typeof key === "string") &&
    typeof item.clientId === "string" &&
    typeof item.queuedAt === "string"
  );
}

async function postAction(
  action: LearningReviewActionInput,
  token: string
): Promise<LearningReviewMutationResponse | null> {
  try {
    const response = await fetch(`${getApiUrl()}/api/learning/review`, {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify(action),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<LearningReviewMutationResponse> | null;
    const review = normalizeReview(data);
    if (!review) return null;
    return {
      ...review,
      applied: typeof data?.applied === "number" ? data.applied : 0,
      duplicate: Boolean(data?.duplicate),
    };
  } catch {
    return null;
  }
}

/**
 * 管理复习计划。离线时操作会带着 clientId 入队，恢复后再重放；
 * 重放不会重复延长 `snooze`，服务端事件表会识别同一 clientId。
 */
export async function applyLearningReviewAction(input: {
  action: "snooze" | "pause" | "resume" | "complete";
  questionKeys: string[];
  snoozeDays?: number;
}): Promise<{ queued: boolean; review: LearningReviewMutationResponse | null }> {
  const token = useAppStore.getState().token;
  const action: LearningReviewActionInput = {
    action: input.action,
    questionKeys: [...new Set(input.questionKeys)],
    clientId: makeClientId(),
    ...(input.snoozeDays
      ? {
          snoozeDays: input.snoozeDays,
          snoozeUntil: new Date(Date.now() + input.snoozeDays * 86_400_000).toISOString(),
        }
      : {}),
  };
  if (!token) {
    await writeQueue([...(await readQueue()), { ...action, queuedAt: new Date().toISOString() }]);
    return { queued: true, review: null };
  }
  const review = await postAction(action, token);
  if (review) return { queued: false, review };
  await writeQueue([...(await readQueue()), { ...action, queuedAt: new Date().toISOString() }]);
  return { queued: true, review: null };
}

/** 登录后/回前台时重放离线复习操作，返回成功提交数。 */
export async function flushLearningReviewActions(token?: string): Promise<number> {
  const authToken = token ?? useAppStore.getState().token;
  if (!authToken) return 0;
  const queue = await readQueue();
  if (queue.length === 0) return 0;
  const pending: QueuedReviewAction[] = [];
  let applied = 0;
  for (const item of queue) {
    const review = await postAction(item, authToken);
    if (review) applied += 1;
    else pending.push(item);
  }
  await writeQueue(pending);
  return applied;
}
