import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";

/**
 * 408 刷卡（v1.55）：App 端数据层。
 *
 * 与 Web 共用同一套接口与 FSRS 状态（服务端是唯一事实源）：
 * - GET  /api/exam/408/cards?mode=queue&subject=&limit=   → 到期队列 + 今日统计
 * - GET  /api/exam/408/cards?mode=stats&subject=          → 科目维度统计（恒 4 行）
 * - POST /api/exam/408/cards  { cardKey, rating, clientId } → 提交评级（幂等，返回新 stats 片段）
 *
 * 三条纪律（见 apps/mobile/CLAUDE.md「乐观 UI + 离线发件箱」）：
 * 1) 评级先本地推进 UI，**只有服务端确认成功**才接受它的 stats；失败一律入队，不假装成功；
 * 2) 重新 load() 时若网络失败，必须回落到本地缓存队列 + 合并待同步评级，
 *    绝不能用空列表覆盖用户看到的卡；
 * 3) 界面上必须有「N 条待同步」状态（pendingRatingCount）。
 *
 * 本文件同时是纯函数层：归一化 / 游标 / 进度 / 统计合并 / 发件箱队列都可单测，
 * 网络与存储出口集中在文件末尾，测试里 mock 掉即可。
 */

/* ------------------------------------------------------------------ */
/* 契约类型（与 task-15 的 Web 实现逐字对齐，2026-11-01 定稿）              */
/* ------------------------------------------------------------------ */

/** 三档评级：again=忘了、hard=模糊、good=掌握（服务端另接受 easy，客户端不暴露）。 */
export const EXAM_408_CARD_RATINGS = ["again", "hard", "good"] as const;
export type Exam408CardRating = (typeof EXAM_408_CARD_RATINGS)[number];

/** 服务端 subject_key 是**裸**科目 key（不是 beokayy-408/xxx 那种带前缀形态）。 */
export const EXAM_408_CARD_SUBJECTS = [
  { key: "data-structure", title: "数据结构" },
  { key: "computer-organization", title: "计算机组成原理" },
  { key: "operating-system", title: "操作系统" },
  { key: "computer-network", title: "计算机网络" },
] as const;

export type Exam408CardSubjectKey = (typeof EXAM_408_CARD_SUBJECTS)[number]["key"];

export function isExam408CardRating(value: unknown): value is Exam408CardRating {
  return typeof value === "string" && (EXAM_408_CARD_RATINGS as readonly string[]).includes(value);
}

export interface Exam408DrillCard {
  key: string;
  subjectKey: string;
  /** 章节号（服务端是数字；脏数据缺失时按 0） */
  chapter: number;
  question: string;
  /** 答题要点，恒为数组（服务端已把脏字符串归一成 []） */
  answerSteps: string[];
  /** 易错点；服务端用 null 表示没有，这里统一成空串，渲染层只管判空 */
  pitfall: string;
  /** 记忆口诀 / 一句话总结；同上 */
  mnemonic: string;
  /** 重点星标（服务端是 boolean，不是 1-5 星） */
  star: boolean;
  /** 关联演示 key（408card 演示逐帧动画），没有则为空串 */
  demoKey: string;
  knowledgePointKey: string;
  /** "new"（从未评过）| "due"（评过且已到期） —— 不要按 learning/review 判断 */
  state: "new" | "due" | string;
  /** 下次到期时间（ISO 8601）；new 卡为 null */
  dueAt: string | null;
}

export interface Exam408CardStats {
  newCount: number;
  dueCount: number;
  doneToday: number;
  streak: number;
}

export interface Exam408CardQueue {
  cards: Exam408DrillCard[];
  stats: Exam408CardStats;
  generatedAt: string;
}

export const EMPTY_CARD_STATS: Exam408CardStats = {
  newCount: 0,
  dueCount: 0,
  doneToday: 0,
  streak: 0,
};

export const EMPTY_CARD_QUEUE: Exam408CardQueue = {
  cards: [],
  stats: EMPTY_CARD_STATS,
  generatedAt: "",
};

export interface Exam408CardTotals {
  cards: number;
  newCount: number;
  dueCount: number;
  learningCount: number;
  masteredCount: number;
}

export interface Exam408CardToday {
  done: number;
  correct: number;
  wrong: number;
  /** 0~1；done=0 时服务端给 null */
  accuracy: number | null;
}

export interface Exam408CardSubjectStat {
  subjectKey: string;
  title: string;
  cards: number;
  newCount: number;
  dueCount: number;
  learningCount: number;
  masteredCount: number;
  doneToday: number;
  correctToday: number;
  accuracy: number | null;
}

export interface Exam408CardStatsBoard {
  totals: Exam408CardTotals;
  today: Exam408CardToday;
  streak: number;
  subjects: Exam408CardSubjectStat[];
}

export const EMPTY_CARD_TOTALS: Exam408CardTotals = {
  cards: 0,
  newCount: 0,
  dueCount: 0,
  learningCount: 0,
  masteredCount: 0,
};

export const EMPTY_CARD_STATS_BOARD: Exam408CardStatsBoard = {
  totals: EMPTY_CARD_TOTALS,
  today: { done: 0, correct: 0, wrong: 0, accuracy: null },
  streak: 0,
  subjects: [],
};

/** POST /api/exam/408/cards 成功体（只用其中与 UI 有关的字段）。 */
export interface Exam408RatingResult {
  cardKey: string;
  rating: Exam408CardRating;
  isCorrect: boolean;
  state: string;
  dueAt: string;
  intervalDays: number;
  streak: number;
  doneToday: number;
  remainingDue: number;
}

export type Exam408FetchFailure = "unauthorized" | "offline" | "server";

export interface Exam408QueueFetch {
  queue: Exam408CardQueue | null;
  failure: Exam408FetchFailure | null;
}

export interface Exam408BoardFetch {
  board: Exam408CardStatsBoard | null;
  failure: Exam408FetchFailure | null;
}

/* ------------------------------------------------------------------ */
/* 纯函数：归一化                                                        */
/* ------------------------------------------------------------------ */

function textOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** 非负整数（统计口径只接受 0 与正整数，负数/小数一律夹到 0）。 */
function countNumber(value: unknown, fallback = 0): number {
  const parsed = finiteNumber(value, fallback);
  return parsed > 0 ? Math.floor(parsed) : 0;
}

/** 0~1 的比率；服务端 done=0 时给 null，这里保持 null（渲染层显示「—」）。 */
function ratioOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = finiteNumber(value, Number.NaN);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

/**
 * 答题要点归一化。
 *
 * 契约保证是 string[]，但客户端不能假设：服务端清洗过一次，历史脏数据仍可能是
 * 单个字符串（换行/分号分隔）或含非字符串元素。字符串按行拆，空行丢弃。
 */
export function normalizeAnswerSteps(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|[；;]/)
      : [];
  const steps: string[] = [];
  for (const item of raw) {
    // 数组元素内部的换行也展开成多步（脏数据常见写法）
    for (const line of textOrEmpty(item).split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) steps.push(trimmed);
    }
  }
  return steps;
}

/** 单张卡归一化；缺 key 或缺题干视为非卡片（返回 null，调用方过滤掉）。 */
export function normalizeDrillCard(value: unknown): Exam408DrillCard | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const key = textOrEmpty(raw.key) || textOrEmpty(raw.cardKey);
  const question = textOrEmpty(raw.question) || textOrEmpty(raw.front);
  if (!key || !question) return null;
  const dueAt = textOrEmpty(raw.dueAt);
  return {
    key,
    // subjectKey 缺失时不猜（空串 ⇒ 界面不显示科目 chip，但卡仍可刷）
    subjectKey: textOrEmpty(raw.subjectKey) || textOrEmpty(raw.subject_key),
    chapter: countNumber(raw.chapter),
    question,
    answerSteps: normalizeAnswerSteps(raw.answerSteps ?? raw.answer_steps),
    pitfall: textOrEmpty(raw.pitfall),
    mnemonic: textOrEmpty(raw.mnemonic),
    star: raw.star === true || raw.star === "true" || countNumber(raw.star) > 0,
    demoKey: textOrEmpty(raw.demoKey) || textOrEmpty(raw.demo_key),
    knowledgePointKey: textOrEmpty(raw.knowledgePointKey),
    state: textOrEmpty(raw.state) || "new",
    dueAt: dueAt || null,
  };
}

/** 队列归一化：payload 不可用（不是对象 / cards 不是数组）返回 null，调用方回落缓存。 */
export function normalizeCardQueue(value: unknown): Exam408CardQueue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.cards)) return null;
  const cards = raw.cards
    .map((item) => normalizeDrillCard(item))
    .filter((card): card is Exam408DrillCard => card !== null);
  const statsRaw = (raw.stats && typeof raw.stats === "object" ? raw.stats : {}) as Record<string, unknown>;
  const stats: Exam408CardStats = {
    newCount: countNumber(statsRaw.newCount),
    dueCount: countNumber(statsRaw.dueCount),
    doneToday: countNumber(statsRaw.doneToday),
    streak: countNumber(statsRaw.streak),
  };
  return { cards, stats, generatedAt: textOrEmpty(raw.generatedAt) };
}

function normalizeSubjectStat(value: unknown): Exam408CardSubjectStat | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const subjectKey = textOrEmpty(raw.subjectKey) || textOrEmpty(raw.subject_key);
  if (!subjectKey) return null;
  const fallbackTitle =
    EXAM_408_CARD_SUBJECTS.find((subject) => subject.key === subjectKey)?.title ?? subjectKey;
  return {
    subjectKey,
    title: textOrEmpty(raw.title) || fallbackTitle,
    cards: countNumber(raw.cards),
    newCount: countNumber(raw.newCount),
    dueCount: countNumber(raw.dueCount),
    learningCount: countNumber(raw.learningCount),
    masteredCount: countNumber(raw.masteredCount),
    doneToday: countNumber(raw.doneToday),
    correctToday: countNumber(raw.correctToday),
    accuracy: ratioOrNull(raw.accuracy),
  };
}

/** 科目维度统计归一化；payload 不可用返回 null（调用方回落到空板）。 */
export function normalizeCardStatsBoard(value: unknown): Exam408CardStatsBoard | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const totalsRaw = (raw.totals && typeof raw.totals === "object" ? raw.totals : {}) as Record<string, unknown>;
  const todayRaw = (raw.today && typeof raw.today === "object" ? raw.today : {}) as Record<string, unknown>;
  const subjects = Array.isArray(raw.subjects)
    ? raw.subjects
        .map((item) => normalizeSubjectStat(item))
        .filter((item): item is Exam408CardSubjectStat => item !== null)
    : [];
  // 四个字段全空且没有 subject 行时，视为"不是统计体"（例如 500 的错误体被当成 200 解析）
  const hasShape =
    Object.keys(totalsRaw).length > 0 ||
    Object.keys(todayRaw).length > 0 ||
    typeof raw.streak === "number" ||
    subjects.length > 0;
  if (!hasShape) return null;
  return {
    totals: {
      cards: countNumber(totalsRaw.cards),
      newCount: countNumber(totalsRaw.newCount),
      dueCount: countNumber(totalsRaw.dueCount),
      learningCount: countNumber(totalsRaw.learningCount),
      masteredCount: countNumber(totalsRaw.masteredCount),
    },
    today: {
      done: countNumber(todayRaw.done),
      correct: countNumber(todayRaw.correct),
      wrong: countNumber(todayRaw.wrong),
      accuracy: ratioOrNull(todayRaw.accuracy),
    },
    streak: countNumber(raw.streak),
    subjects,
  };
}

/** POST 成功体归一化；缺 cardKey 视为失败（避免把错误体当成成功）。 */
export function normalizeRatingResult(value: unknown): Exam408RatingResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const cardKey = textOrEmpty(raw.cardKey);
  if (!cardKey || raw.ok === false) return null;
  const rating = isExam408CardRating(raw.rating) ? raw.rating : "good";
  return {
    cardKey,
    rating,
    isCorrect: raw.isCorrect === true || rating !== "again",
    state: textOrEmpty(raw.state),
    dueAt: textOrEmpty(raw.dueAt),
    intervalDays: countNumber(raw.intervalDays),
    streak: countNumber(raw.streak),
    doneToday: countNumber(raw.doneToday),
    remainingDue: countNumber(raw.remainingDue),
  };
}

/* ------------------------------------------------------------------ */
/* 纯函数：游标 / 进度 / 统计合并                                         */
/* ------------------------------------------------------------------ */

/** 下一张卡的下标；返回 total 表示本轮刷完（用 total 而不是 -1，便于算进度）。 */
export function nextCardIndex(index: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const current = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  return current + 1 < total ? current + 1 : total;
}

export function clampCardIndex(index: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), total);
}

export function cardProgress(index: number, total: number): { done: number; total: number; percent: number } {
  const totalSafe = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const done = clampCardIndex(index, totalSafe);
  const percent = totalSafe === 0 ? 0 : Math.round((done / totalSafe) * 100);
  return { done, total: totalSafe, percent };
}

/**
 * 从队列里移除一张已评级的卡（用于更新离线缓存）。
 *
 * 为什么缓存也要动：离线时评级已经本地推进了游标，但服务端队列没变；若重启后
 * 仍在离线状态，缓存里的这张卡会重新出现，用户以为"没保存"又评一次。
 * 服务端是权威，联网后整条队列会重新拉取覆盖。
 */
export function removeCardFromQueue(queue: Exam408CardQueue, cardKey: string): Exam408CardQueue {
  const cards = queue.cards.filter((card) => card.key !== cardKey);
  if (cards.length === queue.cards.length) return queue;
  return { ...queue, cards };
}

/** 本地乐观推进：评完一张，今日 +1、待复习 -1（夹到 0，服务端确认后会再校正）。 */
export function applyLocalRatingStats(
  stats: Exam408CardStats,
  rating: Exam408CardRating = "good",
): Exam408CardStats {
  return {
    ...stats,
    doneToday: stats.doneToday + 1,
    // 忘掉的卡当天还会再次入队，所以只有 not again 才减待复习
    dueCount: rating === "again" ? stats.dueCount : Math.max(0, stats.dueCount - 1),
  };
}

/**
 * 服务端 POST 返回的计数是权威值，用它覆盖本地乐观值（doneToday/streak/待复习）。
 *
 * newCount 服务端不回（只回 remainingDue），所以由调用方告知这张卡评级前是不是新卡：
 * 是则本地 -1，否则保持不变 —— 否则「新卡 529」在刷了一下午后还是 529。
 */
export function mergeRatingResultStats(
  stats: Exam408CardStats,
  result: Exam408RatingResult,
  ratedState?: string,
): Exam408CardStats {
  return {
    newCount: ratedState === "new" ? Math.max(0, stats.newCount - 1) : stats.newCount,
    dueCount: Math.max(0, result.remainingDue),
    doneToday: result.doneToday > 0 ? result.doneToday : stats.doneToday,
    streak: Math.max(stats.streak, result.streak),
  };
}

/** 待同步评级数合并进统计：离线刷的卡今天也算刷过（界面显示口径）。 */
export function mergeCardStatsWithPending(stats: Exam408CardStats, pending: number): Exam408CardStats {
  if (pending <= 0) return stats;
  return {
    ...stats,
    doneToday: stats.doneToday + pending,
    dueCount: Math.max(0, stats.dueCount - pending),
  };
}

/** 科目行 → 队列口径统计（「全部」未选时给科目 chip 显示待刷数）。 */
export function subjectStatToCardStats(subject: Exam408CardSubjectStat | undefined | null): Exam408CardStats {
  if (!subject) return EMPTY_CARD_STATS;
  return {
    newCount: subject.newCount,
    dueCount: subject.dueCount,
    doneToday: subject.doneToday,
    streak: 0,
  };
}

/** 正确率文案：0.75 → "75%"；null → "—"。 */
export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null || !Number.isFinite(accuracy)) return "—";
  return Math.round(accuracy * 100) + "%";
}

/* ------------------------------------------------------------------ */
/* 纯函数：刷卡状态机（P11 修复：翻面 / 评级视觉 / 进度文案）              */
/* ------------------------------------------------------------------ */

/**
 * 翻面状态机。
 *
 * P11 历史 bug：动画共享值 flip 与 React state flipped 是**双源**，且背面 ScrollView
 * 抢走点击 → 「显示答案后再点无法收起」。现在 flipped 是唯一事实源，动画值只跟随；
 * 正/背面都挂同一个 toggle，所以任意位置都能来回翻。
 */
export type Exam408DrillFace = "question" | "answer";

export function flipPhaseOf(flipped: boolean): Exam408DrillFace {
  return flipped ? "answer" : "question";
}

export function toggleFlipPhase(face: Exam408DrillFace): Exam408DrillFace {
  return face === "answer" ? "question" : "answer";
}

/** 动作文案：题干态「显示答案」，答案态「隐藏答案」。 */
export function flipActionLabel(flipped: boolean): string {
  return flipped ? "隐藏答案" : "显示答案";
}

/** 只有答案面才允许评级（避免没看答案就随手打分）。 */
export function canSubmitRating(flipped: boolean): boolean {
  return flipped;
}

export interface Exam408RatingVisual {
  label: string;
  hint: string;
  /** Ionicons 名（屏幕交给 ThemedIcon） */
  icon: string;
  /** 语义色档：屏幕按主题取 colors.danger / warning / success */
  tone: "danger" | "warning" | "success";
  /** 卡片滑出方向：-1 左、0 原位淡化、1 右（纯视觉） */
  direction: -1 | 0 | 1;
}

/** 三档评级的展示属性（文案/图标/色档/滑出方向）：屏幕不再各自硬编码。 */
export function ratingVisual(rating: Exam408CardRating): Exam408RatingVisual {
  switch (rating) {
    case "again":
      return { label: "忘记", hint: "很快再见", icon: "refresh", tone: "danger", direction: -1 };
    case "hard":
      return { label: "模糊", hint: "缩短间隔", icon: "alert-circle", tone: "warning", direction: 0 };
    case "good":
    default:
      return { label: "掌握", hint: "拉长间隔", icon: "checkmark-circle", tone: "success", direction: 1 };
  }
}

export function ratingLabel(rating: Exam408CardRating): string {
  return ratingVisual(rating).label;
}

export function ratingHint(rating: Exam408CardRating): string {
  return ratingVisual(rating).hint;
}

/** 评级按钮驱动的滑出方向（-1 左 / 0 原位淡化 / 1 右）。 */
export function ratingDirectionOf(rating: Exam408CardRating): -1 | 0 | 1 {
  return ratingVisual(rating).direction;
}

/**
 * 进度文案：「第 x / N 张」，刷完显示「已完成」。
 * 下标可能等于 total（刷完那一刻），这里夹住，不会出现「第 21 / 20 张」。
 */
export function progressLabel(index: number, total: number, finished: boolean): string {
  const totalSafe = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  if (totalSafe === 0) return "暂无卡片";
  if (finished) return "第 " + totalSafe + " / " + totalSafe + " 张 · 已完成";
  const done = clampCardIndex(index, totalSafe);
  const current = Math.min(done, totalSafe - 1) + 1;
  return "第 " + current + " / " + totalSafe + " 张";
}

/* ------------------------------------------------------------------ */
/* 纯函数：刷卡页布局（P13）                                             */
/* ------------------------------------------------------------------ */

export interface Exam408DrillLayout {
  /** 小屏/紧凑档（隐藏统计小字、收紧间距与按钮高度） */
  compact: boolean;
  /** 卡片最小高度（flex:1 的地板）：保证中间卡片占主体，又不至于把底部按钮挤出屏幕 */
  cardMinHeight: number;
  /** 评级按钮最小高度（≥44pt 无障碍可点） */
  ratingMinHeight: number;
  /** 纵向间距 */
  gap: number;
  /** 是否显示「待复习 · 正确率 · 连续」统计小字（紧凑档省略，把高度让给卡片） */
  showStatsLine: boolean;
}

/** 顶部/底部固定 chrome 的保守预留（返回栏 44 + 进度 40 + 范围 30 + chip 34 + 间距 + 评级按钮） */
const DRILL_CHROME_RESERVE = 300;
/** 尺寸异常时的兜底可用高（iPhone 13 档），保证纯函数永远返回可用的正数 */
const DRILL_FALLBACK_USABLE = 700;

/**
 * 刷卡页布局档位（P13 布局优化）。
 *
 * 反馈是「显示答案后卡片太小、答案被遮挡」——根因是顶部状态区（大统计卡 + 范围 tab +
 * 科目 chip）吃掉了近一半高度，卡片只剩几十到一百多 pt。这里把档位收成纯函数：
 * 压缩顶部后卡片 flex:1 自然拿到大部分高度，minHeight 只是小屏的地板。
 *
 * @param usableScreen 可用屏幕高（屏幕高 − 状态栏 − 底部安全区）
 */
export function resolveDrillLayout(usableScreen: number): Exam408DrillLayout {
  const raw = typeof usableScreen === "number" && Number.isFinite(usableScreen) ? usableScreen : 0;
  const usable = raw >= 400 ? raw : DRILL_FALLBACK_USABLE;
  // 647（iPhone SE）与 544（320×568 Android）都应走紧凑档；763/926 走常规档
  const compact = usable < 700;
  /**
   * 卡片地板 = 目标占比（常规 58% / 紧凑 52% 的可用高）× 可用高，
   * 再被「可用高 − 固定 chrome 预留」收住：小屏上宁可卡片矮一点，也不能把评级按钮挤出屏幕。
   * 卡片本身是 flex:1，实际高度=剩余全部高度（常规机约 60%–68% 屏高）。
   */
  const target = usable * (compact ? 0.52 : 0.58);
  const cap = Math.max(0, usable - DRILL_CHROME_RESERVE);
  return {
    compact,
    cardMinHeight: Math.round(Math.max(0, Math.min(target, cap))),
    ratingMinHeight: compact ? 64 : 76,
    gap: compact ? 6 : 8,
    showStatsLine: !compact,
  };
}

export interface Exam408SubjectChipDisplay {
  /** chip 主文案（科目名） */
  label: string;
  /** 右侧待复习数；0 时不显示 */
  dueText: string;
  /** 是否有待复习数（决定是否渲染右侧小字） */
  hasDue: boolean;
}

/**
 * 科目 chip 文案（P13：chip 缩到文字宽度）。
 *
 * 旧版 chip 等分/撑满且带第二行「N 待复习」，一行 5 个 chip 横向滚得又长又高；
 * 现在单行「科目名 + 数字」，宽度由内容决定（paddingHorizontal 左右各 12），选中态靠底色+描边。
 */
export function subjectChipDisplay(title: string, due: number): Exam408SubjectChipDisplay {
  const label = typeof title === "string" ? title.trim() : "";
  const safeDue = typeof due === "number" && Number.isFinite(due) && due > 0 ? Math.floor(due) : 0;
  return {
    label,
    dueText: safeDue > 0 ? String(safeDue) : "",
    hasDue: safeDue > 0,
  };
}

/* ------------------------------------------------------------------ */
/* 纯函数：离线发件箱                                                    */
/* ------------------------------------------------------------------ */

export const RATING_OUTBOX_KEY = "lwb.exam408.cards.outbox.v1";
const QUEUE_CACHE_PREFIX = "lwb.exam408.cards.queue.v1";
const STATS_CACHE_KEY = "lwb.exam408.cards.stats.v1";

export interface Exam408RatingOp {
  opId: string;
  cardKey: string;
  rating: Exam408CardRating;
  /** 幂等键：服务端按 clientId 去重（同一 clientId 重放不重复推进 FSRS） */
  clientId: string;
  queuedAt: string;
}

export interface Exam408RatingOutbox {
  ops: Exam408RatingOp[];
}

export const EMPTY_RATING_OUTBOX: Exam408RatingOutbox = { ops: [] };

/** 缓存 key 按科目隔离（选科目后离线也能直接刷该科目队列）。 */
export function queueCacheKey(subjectKey: string): string {
  const bare = subjectKey.trim();
  return bare ? QUEUE_CACHE_PREFIX + ":" + bare : QUEUE_CACHE_PREFIX;
}

export function statsCacheKey(): string {
  return STATS_CACHE_KEY;
}

let opSeq = 0;

export function makeClientId(now = Date.now()): string {
  opSeq += 1;
  return "408card-" + now.toString(36) + "-" + opSeq.toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export function makeRatingOp(
  cardKey: string,
  rating: Exam408CardRating,
  options: { clientId?: string; now?: number } = {},
): Exam408RatingOp {
  const now = options.now ?? Date.now();
  const clientId = options.clientId ?? makeClientId(now);
  return {
    opId: clientId,
    cardKey,
    rating,
    clientId,
    queuedAt: new Date(now).toISOString(),
  };
}

/**
 * 入队并合并：同一张卡只保留最后一次评级（离线连刷同一张卡属于异常路径，
 * 保留最新意图即可，避免补发时把旧评级也写进 FSRS 历史）。
 */
export function enqueueRating(outbox: Exam408RatingOutbox, op: Exam408RatingOp): Exam408RatingOutbox {
  const ops = outbox.ops.filter((item) => item.cardKey !== op.cardKey);
  ops.push(op);
  return { ops };
}

export function dequeueRating(outbox: Exam408RatingOutbox, opId: string): Exam408RatingOutbox {
  return { ops: outbox.ops.filter((item) => item.opId !== opId) };
}

export function pendingRatingCount(outbox: Exam408RatingOutbox): number {
  return outbox.ops.length;
}

/**
 * 补发结果分类：网络错误 / 5xx / 429 值得重试；401 停手（登录后再补）；
 * 其余 4xx（参数错、卡不存在）重试无意义，丢弃以免堵住队首。
 */
export function classifyRatingFailure(status: number): "retry" | "drop" {
  if (status === 0) return "retry"; // 网络异常（fetch 抛错时约定传 0）
  if (status === 401) return "retry";
  if (status === 408 || status === 429) return "retry";
  if (status >= 500) return "retry";
  return "drop";
}

/* ------------------------------------------------------------------ */
/* 存储出口                                                              */
/* ------------------------------------------------------------------ */

export async function loadCachedQueue(subjectKey: string): Promise<Exam408CardQueue | null> {
  try {
    const raw = await AsyncStorage.getItem(queueCacheKey(subjectKey));
    if (!raw) return null;
    return normalizeCardQueue(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveCachedQueue(subjectKey: string, queue: Exam408CardQueue): Promise<void> {
  try {
    // 空队列也要写：否则"今天全刷完了 + 断网重启"会被误判成"没有缓存"（回到错误态）
    await AsyncStorage.setItem(queueCacheKey(subjectKey), JSON.stringify(queue));
  } catch {
    // 缓存失败不阻塞刷卡
  }
}

export async function loadCachedStatsBoard(): Promise<Exam408CardStatsBoard | null> {
  try {
    const raw = await AsyncStorage.getItem(statsCacheKey());
    if (!raw) return null;
    return normalizeCardStatsBoard(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveCachedStatsBoard(board: Exam408CardStatsBoard): Promise<void> {
  try {
    await AsyncStorage.setItem(statsCacheKey(), JSON.stringify(board));
  } catch {
    // 同上
  }
}

export async function loadRatingOutbox(): Promise<Exam408RatingOutbox> {
  try {
    const raw = await AsyncStorage.getItem(RATING_OUTBOX_KEY);
    if (!raw) return EMPTY_RATING_OUTBOX;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return EMPTY_RATING_OUTBOX;
    const ops = (parsed as { ops?: unknown }).ops;
    if (!Array.isArray(ops)) return EMPTY_RATING_OUTBOX;
    const clean = ops
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        opId: textOrEmpty(item.opId) || textOrEmpty(item.clientId),
        cardKey: textOrEmpty(item.cardKey),
        rating: isExam408CardRating(item.rating) ? item.rating : ("good" as Exam408CardRating),
        clientId: textOrEmpty(item.clientId),
        queuedAt: textOrEmpty(item.queuedAt),
      }))
      .filter((item) => item.cardKey && item.clientId);
    return { ops: clean };
  } catch {
    return EMPTY_RATING_OUTBOX;
  }
}

export async function saveRatingOutbox(outbox: Exam408RatingOutbox): Promise<void> {
  try {
    if (outbox.ops.length === 0) await AsyncStorage.removeItem(RATING_OUTBOX_KEY);
    else await AsyncStorage.setItem(RATING_OUTBOX_KEY, JSON.stringify(outbox));
  } catch {
    // 存储失败不阻塞刷卡
  }
}

/* ------------------------------------------------------------------ */
/* 网络出口                                                              */
/* ------------------------------------------------------------------ */

function authHeaders(token: string, json = false): Record<string, string> {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: "Bearer " + token,
  };
}

function cardsUrl(query: string): string {
  return getApiUrl().replace(/\/+$/, "") + "/api/exam/408/cards?" + query;
}

async function getJson(
  url: string,
  token: string,
): Promise<{ data: unknown; failure: Exam408FetchFailure | null }> {
  try {
    const response = await fetch(url, { headers: authHeaders(token) });
    if (response.status === 401) return { data: null, failure: "unauthorized" };
    if (!response.ok) return { data: null, failure: "server" };
    return { data: (await response.json()) as unknown, failure: null };
  } catch {
    return { data: null, failure: "offline" };
  }
}

/** 拉支付队列；未登录 → failure="unauthorized"（界面引导登录）。 */
export async function fetchCardQueue(
  subjectKey = "",
  limit = 20,
): Promise<Exam408QueueFetch> {
  const token = useAppStore.getState().token;
  if (!token) return { queue: null, failure: "unauthorized" };
  const query = ["mode=queue"];
  if (subjectKey.trim()) query.push("subject=" + encodeURIComponent(subjectKey.trim()));
  if (limit > 0) query.push("limit=" + Math.min(50, Math.floor(limit)));
  const { data, failure } = await getJson(cardsUrl(query.join("&")), token);
  if (failure) return { queue: null, failure };
  const queue = normalizeCardQueue(data);
  // 200 但结构不认识（例如网关返回 HTML/错误体）：按 server 失败处理，回落到缓存
  if (!queue) return { queue: null, failure: "server" };
  return { queue, failure: null };
}

/** 科目维度统计（恒 4 行；未登录 / 失败时调用方用缓存或空板）。 */
export async function fetchCardStatsBoard(subjectKey = ""): Promise<Exam408BoardFetch> {
  const token = useAppStore.getState().token;
  if (!token) return { board: null, failure: "unauthorized" };
  const query = ["mode=stats"];
  if (subjectKey.trim()) query.push("subject=" + encodeURIComponent(subjectKey.trim()));
  const { data, failure } = await getJson(cardsUrl(query.join("&")), token);
  if (failure) return { board: null, failure };
  const board = normalizeCardStatsBoard(data);
  if (!board) return { board: null, failure: "server" };
  return { board, failure: null };
}

export interface SubmitRatingOutcome {
  ok: boolean;
  /** 是否值得稍后重试（离线/401/5xx）；false 表示 4xx 语义错误，重试无意义 */
  retryable: boolean;
  result: Exam408RatingResult | null;
}

/** 提交一次评级。网络异常按 retryable 返回，由调用方入队。 */
export async function submitCardRating(input: {
  cardKey: string;
  rating: Exam408CardRating;
  clientId: string;
}): Promise<SubmitRatingOutcome> {
  const token = useAppStore.getState().token;
  if (!token) return { ok: false, retryable: true, result: null };
  try {
    const response = await fetch(getApiUrl().replace(/\/+$/, "") + "/api/exam/408/cards", {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      return {
        ok: false,
        retryable: classifyRatingFailure(response.status) === "retry",
        result: null,
      };
    }
    const result = normalizeRatingResult(await response.json());
    if (!result) return { ok: false, retryable: false, result: null };
    return { ok: true, retryable: false, result };
  } catch {
    return { ok: false, retryable: true, result: null };
  }
}

/**
 * 补发离线评级（顺序发送，遇到 retry 停下保持顺序；drop 的直接丢弃）。
 * 返回 { sent, remaining }，界面据此刷新「N 条待同步」。
 */
export async function flushRatingOutbox(): Promise<{ sent: number; remaining: number }> {
  const token = useAppStore.getState().token;
  if (!token) {
    const outbox = await loadRatingOutbox();
    return { sent: 0, remaining: pendingRatingCount(outbox) };
  }
  let outbox = await loadRatingOutbox();
  let sent = 0;
  while (outbox.ops.length > 0) {
    const op = outbox.ops[0];
    const outcome = await submitCardRating({
      cardKey: op.cardKey,
      rating: op.rating,
      clientId: op.clientId,
    });
    if (!outcome.ok && outcome.retryable) break;
    outbox = dequeueRating(outbox, op.opId);
    if (outcome.ok) sent += 1;
    await saveRatingOutbox(outbox);
  }
  return { sent, remaining: pendingRatingCount(outbox) };
}
