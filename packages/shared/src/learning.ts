import { z } from "zod";

export const learningAttemptInputSchema = z.object({
  questionKey: z.string().min(1).max(120),
  trackSlug: z.string().min(1).max(80),
  stageKey: z.string().min(1).max(120),
  chosenAnswer: z.array(z.string().min(1).max(120)).min(1).max(8),
  /** 客户端稳定幂等键；重试同一作答不会重复推进复习计划 */
  clientId: z.string().min(8).max(120).optional(),
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
  /** 参与计算的最近题数（窗口内） */
  sampleSize: number;
  /** 参与计算的去重题目数 */
  questionCount: number;
  /** 最近一次练习时间；没有作答时为 null */
  latestAttemptAt: string | null;
  /** 固定口径标识，便于 Web / 移动端解释同一套数字 */
  method: "bounded_recent_accuracy_with_recency";
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

export const learningReviewStatusSchema = z.enum(["learning", "review", "mastered", "suspended"]);
export type LearningReviewStatus = z.infer<typeof learningReviewStatusSchema>;

export const learningReviewAlgorithmVersion = "sm2-lwb-v2" as const;

export const learningReviewActionSchema = z
  .object({
    action: z.enum(["snooze", "pause", "resume", "complete"]),
    questionKeys: z.array(z.string().min(1).max(120)).min(1).max(100),
    clientId: z.string().min(8).max(120),
    /** 延后天数与绝对时间二选一；绝对时间用于保留客户端时区语义 */
    snoozeDays: z.number().int().min(1).max(30).optional(),
    snoozeUntil: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action !== "snooze") return;
    if (!value.snoozeDays && !value.snoozeUntil) {
      ctx.addIssue({
        code: "custom",
        path: ["snoozeDays"],
        message: "snooze requires snoozeDays or snoozeUntil",
      });
    }
  });
export type LearningReviewActionInput = z.infer<typeof learningReviewActionSchema>;

export const learningReviewCardSchema = z.object({
  questionKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string().nullable(),
  status: learningReviewStatusSchema,
  intervalDays: z.number(),
  ease: z.number(),
  streak: z.number(),
  lapses: z.number(),
  dueAt: z.string(),
  lastResult: z.boolean().nullable(),
  algorithmVersion: z.string(),
  scheduleReason: z.string(),
  suspendedFromStatus: learningReviewStatusSchema.nullable(),
  updatedAt: z.string(),
});
export type LearningReviewCard = z.infer<typeof learningReviewCardSchema>;

export const learningWeakTopicSchema = z.object({
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string(),
  title: z.string(),
  dueCount: z.number(),
  wrongCount: z.number(),
});
export type LearningWeakTopic = z.infer<typeof learningWeakTopicSchema>;

export const learningReviewResponseSchema = z.object({
  cards: z.array(learningReviewCardSchema),
  weakTopics: z.array(learningWeakTopicSchema),
  dueCount: z.number(),
  totalCount: z.number(),
  masteredCount: z.number(),
  suspendedCount: z.number(),
  generatedAt: z.string(),
});
export type LearningReviewResponse = z.infer<typeof learningReviewResponseSchema>;

export const learningReviewMutationResponseSchema = learningReviewResponseSchema.extend({
  applied: z.number(),
  duplicate: z.boolean(),
});
export type LearningReviewMutationResponse = z.infer<typeof learningReviewMutationResponseSchema>;

export const learningSchedulerModeSchema = z.enum(["off", "shadow"]);
export type LearningSchedulerMode = z.infer<typeof learningSchedulerModeSchema>;

export const learningSchedulerActionSchema = z.object({
  action: z.enum(["enable_shadow", "disable_shadow"]),
  trackSlug: z.string().min(1).max(80).optional(),
});
export type LearningSchedulerActionInput = z.infer<typeof learningSchedulerActionSchema>;

export const learningSchedulerHorizonSchema = z.object({
  days: z.number(),
  sm2DueCount: z.number(),
  fsrsDueCount: z.number(),
  overlapCount: z.number(),
  sm2OnlyCount: z.number(),
  fsrsOnlyCount: z.number(),
});
export type LearningSchedulerHorizon = z.infer<typeof learningSchedulerHorizonSchema>;

export const learningSchedulerEvaluationSchema = z.object({
  algorithmVersion: z.string(),
  source: z.enum(["stored_shadow", "replayed_attempts"]),
  generatedAt: z.string(),
  sampleCount: z.number(),
  shadowedCount: z.number(),
  coverage: z.number(),
  meanAbsoluteDueDayDiff: z.number().nullable(),
  p90AbsoluteDueDayDiff: z.number().nullable(),
  horizons: z.array(learningSchedulerHorizonSchema),
  stateCounts: z.object({
    new: z.number(),
    learning: z.number(),
    review: z.number(),
    relearning: z.number(),
  }),
});
export type LearningSchedulerEvaluation = z.infer<typeof learningSchedulerEvaluationSchema>;

export const learningSchedulerResponseSchema = z.object({
  mode: learningSchedulerModeSchema,
  modeSource: z.enum(["track", "global", "default"]),
  trackSlug: z.string().nullable(),
  evaluation: learningSchedulerEvaluationSchema,
});
export type LearningSchedulerResponse = z.infer<typeof learningSchedulerResponseSchema>;

export interface LearningReviewScheduleState {
  status: LearningReviewStatus;
  intervalDays: number;
  ease: number;
  streak: number;
  lapses: number;
  dueAt: string;
  suspendedFromStatus: LearningReviewStatus | null;
}

export interface LearningReviewScheduleResult extends LearningReviewScheduleState {
  algorithmVersion: typeof learningReviewAlgorithmVersion;
  scheduleReason: string;
  completedAt: string | null;
  suspendedAt: string | null;
}

const REVIEW_INTERVAL_MIN = 7;
const REVIEW_INTERVAL_MAX = 60;
const REVIEW_EASE_MIN = 1.3;
const REVIEW_EASE_MAX = 3.5;

function isoAfterDays(from: Date, days: number): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 当前服务端调度器的纯函数版本。
 *
 * 算法仍是可迁移的 SM-2 变体，而不是直接套 FSRS：
 *   - 首次答对 1 天，之后 3 天、7 天；
 *   - 再往后按 interval × ease 扩展，限制在 7..60 天；
 *   - 答错回到 1 天并降低 ease；连续答对 4 次视为 mastered；
 *   - 暂停卡在被作答时自动恢复，避免离线补交把用户永久留在暂停态。
 */
export function scheduleLearningReview(input: {
  state: LearningReviewScheduleState;
  isCorrect: boolean;
  now: Date;
}): LearningReviewScheduleResult {
  const { state, isCorrect, now } = input;
  const resumedByAttempt = state.status === "suspended";

  if (!isCorrect) {
    return {
      status: "learning",
      intervalDays: 1,
      ease: round2(Math.max(REVIEW_EASE_MIN, state.ease - 0.2)),
      streak: 0,
      lapses: state.lapses + 1,
      dueAt: isoAfterDays(now, 1),
      suspendedFromStatus: null,
      algorithmVersion: learningReviewAlgorithmVersion,
      scheduleReason: resumedByAttempt ? "resumed_by_wrong_attempt" : "wrong_answer",
      completedAt: null,
      suspendedAt: null,
    };
  }

  const intervalDays =
    state.intervalDays === 0
      ? 1
      : state.intervalDays === 1
        ? 3
        : state.intervalDays === 3
          ? 7
          : Math.min(
              REVIEW_INTERVAL_MAX,
              Math.max(REVIEW_INTERVAL_MIN, Math.round(state.intervalDays * state.ease))
            );
  const streak = state.streak + 1;
  return {
    status: streak >= 4 ? "mastered" : "review",
    intervalDays,
    ease: round2(Math.min(REVIEW_EASE_MAX, state.ease + 0.05)),
    streak,
    lapses: state.lapses,
    dueAt: isoAfterDays(now, intervalDays),
    suspendedFromStatus: null,
    algorithmVersion: learningReviewAlgorithmVersion,
    scheduleReason: resumedByAttempt
      ? "resumed_by_correct_attempt"
      : streak >= 4
        ? "mastered_after_four_correct"
        : "correct_answer",
    completedAt: null,
    suspendedAt: null,
  };
}

export function applyLearningReviewAction(input: {
  card: LearningReviewCard;
  action: LearningReviewActionInput["action"];
  now: Date;
  snoozeDays?: number;
  snoozeUntil?: string;
}): LearningReviewCard {
  const { card, action, now } = input;
  if (action === "snooze") {
    const until = input.snoozeUntil ? Date.parse(input.snoozeUntil) : Number.NaN;
    const base = Math.max(
      now.getTime(),
      Date.parse(card.dueAt),
      Number.isFinite(until) ? until : 0
    );
    const days = input.snoozeDays ?? 0;
    const target = input.snoozeUntil ? base : base + Math.max(1, days) * 86_400_000;
    return {
      ...card,
      dueAt: new Date(target).toISOString(),
      scheduleReason: input.snoozeDays ? `snoozed_${input.snoozeDays}d` : "snoozed_until_local",
      updatedAt: now.toISOString(),
    };
  }
  if (action === "pause") {
    if (card.status === "suspended") return card;
    return {
      ...card,
      status: "suspended",
      suspendedFromStatus: card.status,
      scheduleReason: "paused_by_user",
      updatedAt: now.toISOString(),
    };
  }
  if (action === "resume") {
    if (card.status !== "suspended") return card;
    const resumedStatus =
      card.suspendedFromStatus && card.suspendedFromStatus !== "suspended"
        ? card.suspendedFromStatus
        : card.intervalDays > 0
          ? "review"
          : "learning";
    return {
      ...card,
      status: resumedStatus,
      suspendedFromStatus: null,
      dueAt: new Date(Math.max(now.getTime(), Date.parse(card.dueAt))).toISOString(),
      scheduleReason: "resumed_by_user",
      updatedAt: now.toISOString(),
    };
  }
  return {
    ...card,
    status: "mastered",
    suspendedFromStatus: null,
    scheduleReason: "completed_by_user",
    dueAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function isLearningReviewDue(card: LearningReviewCard, now: Date): boolean {
  return card.status !== "mastered" && card.status !== "suspended" && Date.parse(card.dueAt) <= now.getTime();
}

export function learningDayKey(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
      const year = pick("year");
      const month = pick("month");
      const day = pick("day");
      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // 非法时区回退到 UTC，不让统计接口报错。
    }
  }
  return date.toISOString().slice(0, 10);
}

/* ================= 阅读体验状态（阶段 8 = V3 Phase B） ================= */

/** 知识点定位（三段稳定 ID，与 knowledge_points.key / question_knowledge_point 同一套口径） */
export const knowledgePointRefSchema = z.object({
  pointKey: z.string().min(3).max(200),
  trackSlug: z.string().min(1).max(80),
  stageKey: z.string().min(1).max(120),
  topicKey: z.string().min(1).max(120),
});
export type KnowledgePointRef = z.infer<typeof knowledgePointRefSchema>;

/** 阅读状态上报：progress 可选（不传表示"打开了"）；clientId 用于客户端侧幂等重放 */
export const learningReadStateInputSchema = knowledgePointRefSchema.extend({
  progress: z.number().int().min(0).max(100).optional(),
  clientId: z.string().min(1).max(80).optional(),
});
export type LearningReadStateInput = z.infer<typeof learningReadStateInputSchema>;

/** 收藏开关：favorite=false 表示取消收藏（软删除，历史保留可审计） */
export const learningFavoriteInputSchema = knowledgePointRefSchema.extend({
  favorite: z.boolean(),
  note: z.string().max(200).optional(),
});
export type LearningFavoriteInput = z.infer<typeof learningFavoriteInputSchema>;

export const learningReadStateSchema = z.object({
  pointKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string(),
  firstReadAt: z.string(),
  lastReadAt: z.string(),
  progress: z.number(),
  readCount: z.number(),
});
export type LearningReadState = z.infer<typeof learningReadStateSchema>;

export const learningFavoriteSchema = z.object({
  pointKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type LearningFavorite = z.infer<typeof learningFavoriteSchema>;

export const learningLibraryStateSchema = z.object({
  read: z.array(learningReadStateSchema),
  favorites: z.array(learningFavoriteSchema),
  counts: z.object({
    read: z.number(),
    favorites: z.number(),
    /** 近 7 天读过（"本周在读"而不是"历史读过"） */
    readThisWeek: z.number(),
  }),
});
export type LearningLibraryState = z.infer<typeof learningLibraryStateSchema>;

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
    sampleSize: Math.min(unique.length, LEARNING_MASTERY.window),
    questionCount: unique.length,
    latestAttemptAt: newest?.createdAt ?? null,
    method: "bounded_recent_accuracy_with_recency",
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
