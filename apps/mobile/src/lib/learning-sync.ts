import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { LearningAttempt } from "@/lib/learning-progress";

const ATTEMPT_QUEUE_KEY = "lwb-learning-attempt-sync-v1";

async function readQueue(): Promise<LearningAttempt[]> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedAttempt);
  } catch {
    return [];
  }
}

async function writeQueue(queue: LearningAttempt[]): Promise<void> {
  await AsyncStorage.setItem(ATTEMPT_QUEUE_KEY, JSON.stringify(queue.slice(-1000)));
}

function isQueuedAttempt(value: unknown): value is LearningAttempt {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LearningAttempt>;
  return (
    typeof item.clientId === "string" &&
    typeof item.questionKey === "string" &&
    typeof item.trackSlug === "string" &&
    typeof item.stageKey === "string" &&
    Array.isArray(item.chosenAnswer) &&
    item.chosenAnswer.every((answer) => typeof answer === "string") &&
    typeof item.isCorrect === "boolean" &&
    typeof item.createdAt === "string"
  );
}

async function postAttempt(attempt: LearningAttempt, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/api/learning/attempt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        questionKey: attempt.questionKey,
        trackSlug: attempt.trackSlug,
        stageKey: attempt.stageKey,
        chosenAnswer: attempt.chosenAnswer,
        clientId: attempt.clientId,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** 在线同步作答；失败会入队，不阻塞刷题页面。 */
export async function syncLearningAttempt(attempt: LearningAttempt, token?: string): Promise<boolean> {
  const authToken = token ?? useAppStore.getState().token;
  if (!authToken) return false;
  if (await postAttempt(attempt, authToken)) return true;
  const queue = await readQueue();
  if (!queue.some((item) => item.clientId === attempt.clientId)) {
    await writeQueue([...queue, attempt]);
  }
  return false;
}

/** 回前台/登录后重放离线作答，返回成功提交数。 */
export async function flushLearningAttempts(token?: string): Promise<number> {
  const authToken = token ?? useAppStore.getState().token;
  if (!authToken) return 0;
  const queue = await readQueue();
  if (queue.length === 0) return 0;
  const pending: LearningAttempt[] = [];
  let synced = 0;
  for (const attempt of queue) {
    if (await postAttempt(attempt, authToken)) synced += 1;
    else pending.push(attempt);
  }
  await writeQueue(pending);
  return synced;
}
