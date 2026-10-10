import { z } from "zod";

export const learningAttemptInputSchema = z.object({
  questionKey: z.string().min(1).max(120),
  trackSlug: z.string().min(1).max(80),
  stageKey: z.string().min(1).max(120),
  chosenAnswer: z.array(z.string().min(1).max(120)).min(1).max(8),
});
export type LearningAttemptInput = z.infer<typeof learningAttemptInputSchema>;

export const learningAttemptResultSchema = z.object({
  questionKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  isCorrect: z.boolean(),
  answer: z.array(z.string()),
  explanation: z.string(),
  createdAt: z.string(),
});
export type LearningAttemptResult = z.infer<typeof learningAttemptResultSchema>;

export interface LearningProgress {
  attempted: number;
  correct: number;
  wrong: number;
  mastery: number;
  /** 掌握度口径明细，界面据此解释"这个百分比怎么来的" */
  masteryBasis: MasteryBasis;
  today: number;
  recent: LearningAttemptResult[];
}

/* ================= 学习判分与掌握度（Web + 移动端单一实现） ================= */

/**
 * 掌握度口径常量。
 *
 * 旧的「最近一次正确率」把"浏览过"和"掌握"混成一个百分比，且不看练习时间，
 * 一次误答就会把某项从 100% 打到 0%。这里改成可解释的两段式：
 *   mastery = 加权正确率 × (0.6 + 0.4 × 时间新鲜度)
 * 没有作答 → 0；刚全部答对 → 100；答对但久未练 → 趋近 60（提示需要复习）。
 */
export const LEARNING_MASTERY = {
  /** 参与加权的最近作答数 */
  window: 5,
  /** 时间衰减系数 λ（按天），decay = exp(-λ · 未练习天数) */
  lambda: 0.05,
  /** 正确率权重 */
  accuracyWeight: 0.6,
  /** 时间新鲜度权重 */
  recencyWeight: 0.4,
} as const;

export interface LearningAttemptLike {
  questionKey: string;
  isCorrect: boolean;
  createdAt: string;
}

export interface MasteryBasis {
  window: number;
  accuracyWeight: number;
  recencyWeight: number;
  lambda: number;
  /** 指数加权正确率 0..1 */
  weightedAccuracy: number;
  /** 时间新鲜度 0..1 */
  decay: number;
}

export interface LearningSummary {
  attempted: number;
  correct: number;
  wrong: number;
  mastery: number;
  today: number;
  masteryBasis: MasteryBasis;
}

/* ================= 间隔复习（SM-2 卡片，服务端状态） ================= */

export const learningReviewStatusSchema = z.enum(["learning", "review", "mastered"]);
export type LearningReviewStatus = z.infer<typeof learningReviewStatusSchema>;

export const learningReviewCardSchema = z.object({
  questionKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  status: learningReviewStatusSchema,
  intervalDays: z.number(),
  ease: z.number(),
  streak: z.number(),
  lapses: z.number(),
  dueAt: z.string(),
  lastResult: z.boolean().nullable(),
});
export type LearningReviewCard = z.infer<typeof learningReviewCardSchema>;

export const learningReviewResponseSchema = z.object({
  cards: z.array(learningReviewCardSchema),
  dueCount: z.number(),
  totalCount: z.number(),
  masteredCount: z.number(),
});
export type LearningReviewResponse = z.infer<typeof learningReviewResponseSchema>;

/** 归一化作答 token：大小写/空白差异不影响判分 */
export function normalizeAnswerToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 与顺序无关的答案比对（多选题同样适用） */
export function gradeLearningAnswer(expected: readonly string[], chosen: readonly string[]): boolean {
  const want = [...new Set(expected.map(normalizeAnswerToken))].sort();
  const got = [...new Set(chosen.map(normalizeAnswerToken))].sort();
  return got.length === want.length && got.every((value, index) => value === want[index]);
}

/**
 * 指数加权正确率。`results` 必须**按时间倒序**（最新的在前），越新的作答权重越高。
 */
export function weightedAccuracy(results: readonly boolean[]): number {
  const recent = results.slice(0, LEARNING_MASTERY.window);
  let weight = 0;
  let hit = 0;
  for (let index = 0; index < recent.length; index += 1) {
    const w = 2 ** -index;
    weight += w;
    if (recent[index]) hit += w;
  }
  return weight === 0 ? 0 : hit / weight;
}

/** 时间新鲜度 ∈ (0,1]：刚练过≈1，越久越小 */
export function masteryDecay(daysSinceLastPractice: number): number {
  const days = Number.isFinite(daysSinceLastPractice) ? Math.max(0, daysSinceLastPractice) : 0;
  return Math.exp(-LEARNING_MASTERY.lambda * days);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 可解释掌握度（0..100），见 {@link LEARNING_MASTERY} 口径说明 */
export function computeMastery(input: { weightedAccuracy: number; decay: number }): number {
  const accuracy = clamp01(input.weightedAccuracy);
  const weight =
    LEARNING_MASTERY.accuracyWeight + LEARNING_MASTERY.recencyWeight * clamp01(input.decay);
  return Math.round(clamp01(accuracy * weight) * 100);
}

/**
 * 按知识点聚合作答记录，产出阅读/练习分离的统计口径。
 *
 * @param attempts 全部作答（可跨知识点）
 * @param options.pointKeys 限定统计范围（缺省=全部）
 * @param options.todayKey 今日的日期键；给了才统计 today
 * @param options.dayKey 把 ISO 时间转成日期键（Web 用 UTC，移动端用本地日历）
 * @param options.now 计算时间衰减的基准时刻（便于测试注入）
 */
export function summarizeLearningAttempts(
  attempts: readonly LearningAttemptLike[],
  options: {
    pointKeys?: ReadonlySet<string>;
    todayKey?: string;
    dayKey?: (iso: string) => string;
    now?: Date;
  } = {}
): LearningSummary {
  const { pointKeys, todayKey, dayKey = (iso) => iso.slice(0, 10), now = new Date() } = options;
  const scoped = pointKeys
    ? attempts.filter((attempt) => pointKeys.has(attempt.questionKey))
    : [...attempts];

  const latest = new Map<string, LearningAttemptLike>();
  for (const attempt of scoped) {
    const current = latest.get(attempt.questionKey);
    if (!current || current.createdAt < attempt.createdAt) latest.set(attempt.questionKey, attempt);
  }
  const unique = [...latest.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const correct = unique.filter((attempt) => attempt.isCorrect).length;
  const newest = unique[0];
  const daysSince = newest
    ? Math.max(0, (now.getTime() - Date.parse(newest.createdAt)) / 86_400_000)
    : 0;
  const basis: MasteryBasis = {
    window: LEARNING_MASTERY.window,
    accuracyWeight: LEARNING_MASTERY.accuracyWeight,
    recencyWeight: LEARNING_MASTERY.recencyWeight,
    lambda: LEARNING_MASTERY.lambda,
    weightedAccuracy: weightedAccuracy(unique.map((attempt) => attempt.isCorrect)),
    decay: newest ? masteryDecay(daysSince) : 0,
  };

  return {
    attempted: unique.length,
    correct,
    wrong: unique.length - correct,
    mastery: computeMastery(basis),
    today: todayKey ? scoped.filter((attempt) => dayKey(attempt.createdAt) === todayKey).length : 0,
    masteryBasis: basis,
  };
}
