import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LearningQuestion, LearningTrack } from "@learn-workbench/content";
import { localKey } from "@/lib/focus-series";

const ATTEMPTS_KEY = "lwb-learning-attempts-v1";
const MAX_ATTEMPTS = 2000;

export interface LearningAttempt {
  questionKey: string;
  trackSlug: string;
  stageKey: string;
  chosenAnswer: string[];
  isCorrect: boolean;
  createdAt: string;
}

export interface TrackProgressSummary {
  attempted: number;
  correct: number;
  mastery: number;
  wrong: number;
  today: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isLearningAnswerCorrect(question: LearningQuestion, chosenAnswer: string[]): boolean {
  const chosen = [...new Set(chosenAnswer.map(normalize))].sort();
  const expected = [...new Set(question.answer.map(normalize))].sort();
  return chosen.length === expected.length && chosen.every((value, index) => value === expected[index]);
}

export function summarizeLearningAttempts(
  attempts: LearningAttempt[],
  points: LearningQuestion[],
  today = localKey(new Date())
): TrackProgressSummary {
  const pointKeys = new Set(points.map((point) => point.key));
  const scoped = attempts.filter((attempt) => pointKeys.has(attempt.questionKey));
  const latest = new Map<string, LearningAttempt>();
  for (const attempt of scoped) {
    const current = latest.get(attempt.questionKey);
    if (!current || current.createdAt < attempt.createdAt) latest.set(attempt.questionKey, attempt);
  }
  const unique = [...latest.values()];
  const correct = unique.filter((attempt) => attempt.isCorrect).length;
  const wrong = unique.filter((attempt) => !attempt.isCorrect).length;
  const attempted = unique.length;
  return {
    attempted,
    correct,
    wrong,
    mastery: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
    today: scoped.filter((attempt) => localKey(new Date(attempt.createdAt)) === today).length,
  };
}

export function pickLearningQuestions(
  track: LearningTrack,
  options: {
    stageKey?: string | null;
    topicKey?: string | null;
    count?: number;
    seed?: string;
    wrongKeys?: string[];
  } = {}
): LearningQuestion[] {
  const { stageKey, topicKey, count = 12, seed = "", wrongKeys = [] } = options;
  let pool = track.questions.filter((question) => !stageKey || question.stageKey === stageKey);
  if (topicKey) {
    const topicPool = pool.filter((question) => question.topicKey === topicKey);
    if (topicPool.length > 0) {
      const otherPool = pool.filter((question) => question.topicKey !== topicKey);
      return [
        ...shuffleQuestions(topicPool, `${track.slug}:${stageKey ?? "all"}:${topicKey}:${seed}`),
        ...shuffleQuestions(otherPool, `${track.slug}:${stageKey ?? "all"}:stage:${seed}`),
      ].slice(0, count);
    }
  }
  if (wrongKeys.length > 0) {
    const wrongSet = new Set(wrongKeys);
    const preferred = pool.filter((question) => wrongSet.has(question.key));
    if (preferred.length > 0) pool = preferred;
  }
  if (pool.length <= count) return [...pool];
  return shuffleQuestions(pool, `${track.slug}:${stageKey ?? "all"}:${seed}`);
}

function shuffleQuestions(pool: LearningQuestion[], seed: string): LearningQuestion[] {
  if (pool.length <= 1) return [...pool];
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    const j = Math.abs(hash) % (i + 1);
    const current = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = current;
  }
  return shuffled;
}

export async function loadLearningAttempts(): Promise<LearningAttempt[]> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLearningAttempt);
  } catch {
    return [];
  }
}

export async function recordLearningAttempt(attempt: LearningAttempt): Promise<void> {
  try {
    const current = await loadLearningAttempts();
    const next = [...current, attempt].slice(-MAX_ATTEMPTS);
    await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
  } catch {
    // 本地记录失败不应中断刷题。
  }
}

export function wrongQuestionKeys(attempts: LearningAttempt[], trackSlug?: string): string[] {
  const latest = new Map<string, LearningAttempt>();
  for (const attempt of attempts) {
    if (trackSlug && attempt.trackSlug !== trackSlug) continue;
    const current = latest.get(attempt.questionKey);
    if (!current || current.createdAt < attempt.createdAt) latest.set(attempt.questionKey, attempt);
  }
  return [...latest.values()].filter((attempt) => !attempt.isCorrect).map((attempt) => attempt.questionKey);
}

function isLearningAttempt(value: unknown): value is LearningAttempt {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LearningAttempt>;
  return (
    typeof item.questionKey === "string" &&
    typeof item.trackSlug === "string" &&
    typeof item.stageKey === "string" &&
    Array.isArray(item.chosenAnswer) &&
    item.chosenAnswer.every((answer) => typeof answer === "string") &&
    typeof item.isCorrect === "boolean" &&
    typeof item.createdAt === "string"
  );
}
