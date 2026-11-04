import type { Exam408CardStatsBoard, Exam408FetchFailure } from "@/lib/exam-408-cards";
import type { PaperAttemptFailure, PaperAttemptRecord } from "@/lib/paper-history";

/**
 * 408 专区「我的 408 学习统计」视图模型（v2.2 数据面板接入 · 纯函数层）。
 *
 * 为什么单独成 lib：
 * - vitest 只跑单测（environment: node），页面组件渲染不了；指标卡的取值口径、
 *   套卷排行/柱图归一、未登录/失败降级文案这些「边界最多」的地方必须能直接单测（看板踩坑 48）。
 * - 页面只负责布局与 token 取色，不再在 JSX 里堆三元表达式。
 *
 * 依赖纪律：**只用 type import**（exam-408-cards / paper-history 都是带 AsyncStorage 的网络模块）。
 * 类型在编译后被擦除，所以本文件在 node 环境下零副作用、可直接测。
 * 正确率算式与 paper-history.paperAccuracy 同一口径（0-100 四舍五入），这里内联是为了
 * 不把 AsyncStorage 拖进纯函数层；两边改口径时请一起改。
 */

/** 无数据 / 未登录的统一占位（与健康页 NO_RECORD 同字符） */
export const NO_STAT_VALUE = "—";

/** 套卷成绩来源：remote=服务端；local=本机缓存（未登录 / 401 / 离线 / 5xx 的降级路线） */
export type Exam408AttemptsSource = "remote" | "local";

/** 指标卡色调（与 components/v2/charts 的 StatTone 同名，页面直接透传） */
export type Exam408StatTone = "text" | "primary" | "success" | "warning" | "accent" | "teal";

/** 一格指标卡的数据（label/value/unit/hint 全部是**已格式化**的展示串） */
export interface Exam408Stat {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone?: Exam408StatTone;
}

/** BarList（最佳套卷排行）行 */
export interface PaperRankItem {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  hint: string;
}

/** StepsBar（最近套卷得分）柱 */
export interface PaperScoreBar {
  label: string;
  value: number;
  highlight: boolean;
  valueLabel: string;
}

export interface Exam408DashInput {
  board: Exam408CardStatsBoard | null;
  boardFailure: Exam408FetchFailure | null;
  /** 当前 board 是否来自本机缓存（服务端没拿到时的降级） */
  boardCached?: boolean;
  /** 已经过调用方筛选的套卷记录（服务端或本机缓存，倒序） */
  attempts: PaperAttemptRecord[];
  attemptsSource: Exam408AttemptsSource;
  attemptsFailure: PaperAttemptFailure | null;
  /** 服务端总数（可能 > attempts.length，接口按 limit 截断）；缺省用 attempts.length */
  attemptsTotal?: number;
  /** 首次读取中：指标卡显示占位与「读取中」，而不是「登录后同步」 */
  pending?: boolean;
}

export interface Exam408Dash {
  cards: Exam408Stat;
  reviewed: Exam408Stat;
  papers: Exam408Stat;
  best: Exam408Stat;
  /** 套卷图为空时的空态文案（null = 有数据） */
  emptyHint: string | null;
  /** 需要提示「登录 / 本机缓存」时的横幅文案（null = 不需要） */
  notice: string | null;
}

/* ------------------------------------------------------------------ */
/* 基础清洗                                                             */
/* ------------------------------------------------------------------ */

/** 非负整数；NaN / 负数 / 字符串脏值 → null（渲染层显示「—」，而不是假的 0） */
export function countOrNull(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

/** 计数兜底：只用于已知存在的结构（board.today.done 之类），脏值当 0 */
function safeCount(value: unknown): number {
  return countOrNull(value) ?? 0;
}

/** 正确率（0-100）：只按已判对错的题算；没有已判题 → 0。与 paperAccuracy 同口径。 */
export function accuracyPercent(correct: unknown, wrong: unknown): number {
  const right = safeCount(correct);
  const miss = safeCount(wrong);
  const judged = right + miss;
  if (judged <= 0) return 0;
  return Math.round((right / judged) * 100);
}

/** 评过的卡（learning + mastered）；board 缺失 → null */
export function reviewedCardCount(board: Exam408CardStatsBoard | null): number | null {
  if (!board || !board.totals) return null;
  const totals = board.totals;
  return safeCount(totals.learningCount) + safeCount(totals.masteredCount);
}

/** 最佳套卷：按绝对得分取最高（同分保留最近一次 —— attempts 已倒序） */
export function bestPaperScore(
  attempts: readonly PaperAttemptRecord[]
): { score: number; totalScore: number } | null {
  let best: { score: number; totalScore: number } | null = null;
  for (const attempt of attempts) {
    const score = countOrNull(attempt?.score);
    if (score === null) continue;
    if (!best || score > best.score) {
      best = { score, totalScore: safeCount(attempt?.totalScore) };
    }
  }
  return best;
}

/** 平均套卷得分（四舍五入）；没有记录 → null */
export function averagePaperScore(attempts: readonly PaperAttemptRecord[]): number | null {
  let sum = 0;
  let count = 0;
  for (const attempt of attempts) {
    const score = countOrNull(attempt?.score);
    if (score === null) continue;
    sum += score;
    count += 1;
  }
  if (count === 0) return null;
  return Math.round(sum / count);
}

/** 单次得分占满分的比例（0..1）；满分缺失/0 → 0（柱图不会画出溢出柱） */
export function paperScoreRatio(attempt: PaperAttemptRecord | null | undefined): number {
  if (!attempt) return 0;
  const score = safeCount(attempt.score);
  const total = safeCount(attempt.totalScore);
  if (total <= 0 || score <= 0) return 0;
  return Math.min(1, score / total);
}

/* ------------------------------------------------------------------ */
/* 图表数据                                                             */
/* ------------------------------------------------------------------ */

/** 柱图标签：年份（4 位，130% 字号下 6 根柱也放得下） */
function barLabelOf(attempt: PaperAttemptRecord): string {
  const year = countOrNull(attempt?.year);
  return year === null ? "—" : String(year);
}

/**
 * 最近几次套卷得分（StepsBar）：attempts 是倒序（最新在前），
 * 这里取前 limit 条再反转 → 从左到右由旧到新，最后一根（最新）高亮。
 */
export function paperScoreBars(attempts: readonly PaperAttemptRecord[], limit = 6): PaperScoreBar[] {
  const size = Math.max(1, Math.floor(limit));
  const recent = attempts.slice(0, size).reverse();
  return recent.map((attempt, index) => ({
    label: barLabelOf(attempt),
    value: paperScoreRatio(attempt),
    highlight: index === recent.length - 1,
    valueLabel: String(safeCount(attempt?.score)),
  }));
}

/**
 * 最佳套卷排行（BarList）：按得分降序（同分按原始顺序 = 交卷时间新的在前），取前 limit 条。
 * 条长由 BarList 按序列最大值归一，无需在这里算占比。
 */
export function paperScoreRanking(attempts: readonly PaperAttemptRecord[], limit = 5): PaperRankItem[] {
  const size = Math.max(1, Math.floor(limit));
  return attempts
    .map((attempt, index) => ({ attempt, index }))
    .sort((left, right) => {
      const delta = safeCount(right.attempt?.score) - safeCount(left.attempt?.score);
      return delta !== 0 ? delta : left.index - right.index;
    })
    .slice(0, size)
    .map(({ attempt }) => ({
      key: attempt.id,
      label: `${safeCount(attempt?.year)} 年`,
      value: safeCount(attempt?.score),
      valueLabel: `${safeCount(attempt?.score)} 分`,
      hint: `正确率 ${accuracyPercent(attempt?.correct, attempt?.wrong)}%`,
    }));
}

/* ------------------------------------------------------------------ */
/* 指标卡 / 文案                                                        */
/* ------------------------------------------------------------------ */

function cardHintOf(failure: Exam408FetchFailure | null, pending: boolean): string {
  if (pending) return "读取中";
  switch (failure) {
    case "unauthorized":
      return "登录后同步";
    case "offline":
      return "网络异常";
    case "server":
      return "服务异常";
    default:
      return "暂无记录";
  }
}

/** 套卷成绩缺失（未登录 / 离线 / 未交卷）时的短提示 */
function paperHintOf(input: Exam408DashInput, hasPapers: boolean, pending: boolean, avg: number | null): string {
  if (hasPapers && avg !== null) return `均分 ${avg}`;
  if (pending) return "读取中";
  if (input.attemptsSource === "remote") return "暂无成绩";
  switch (input.attemptsFailure) {
    case "unauthorized":
      return "登录后同步";
    case "offline":
      return "离线缓存";
    case "server":
      return "服务异常";
    default:
      return "暂无成绩";
  }
}

/**
 * 四格指标 + 空态/提示文案。**永不抛异常**：任何字段脏数据都收敛成「—」，
 * 408 页其它内容不受统计接口影响。
 */
export function exam408DashStats(input: Exam408DashInput): Exam408Dash {
  const pending = input.pending === true;
  const board = input.board;
  const totals = board?.totals ?? null;
  const reviewed = reviewedCardCount(board);
  const cardHint = totals ? `今日 ${safeCount(board?.today?.done)}` : cardHintOf(input.boardFailure, pending);
  const reviewedHint =
    reviewed === null
      ? cardHintOf(input.boardFailure, pending)
      : `已掌握 ${safeCount(totals?.masteredCount)}`;

  const hasPapers = input.attempts.length > 0;
  const total = Math.max(input.attempts.length, safeCount(input.attemptsTotal));
  const best = bestPaperScore(input.attempts);
  const avg = averagePaperScore(input.attempts);
  const paperHint = paperHintOf(input, hasPapers, pending, avg);
  const paperValue = hasPapers ? String(total) : input.attemptsSource === "remote" ? "0" : NO_STAT_VALUE;

  const cards: Exam408Stat = {
    label: "卡片总数",
    value: totals ? String(safeCount(totals.cards)) : NO_STAT_VALUE,
    ...(totals ? { unit: "张" } : {}),
    hint: cardHint,
    tone: "primary",
  };
  const reviewedStat: Exam408Stat = {
    label: "已刷卡片",
    value: reviewed === null ? NO_STAT_VALUE : String(reviewed),
    ...(reviewed === null ? {} : { unit: "张" }),
    hint: reviewedHint,
    tone: "success",
  };
  const papers: Exam408Stat = {
    label: "套卷次数",
    value: paperValue,
    ...(hasPapers || input.attemptsSource === "remote" ? { unit: "次" } : {}),
    hint: paperHint,
    tone: "accent",
  };
  const bestStat: Exam408Stat = {
    label: "最佳得分",
    value: best ? String(best.score) : NO_STAT_VALUE,
    ...(best ? { unit: "分" } : {}),
    hint: best ? `满分 ${best.totalScore}` : paperHint,
    tone: "warning",
  };

  const emptyHint = hasPapers
    ? null
    : input.attemptsFailure === "unauthorized"
      ? "还没有套卷成绩。登录后自动同步；未登录时交卷记录也会先存在本机。"
      : "还没有套卷成绩。完成一套历年真题后，这里会画出得分走势与最佳排行。";

  return { cards, reviewed: reviewedStat, papers, best: bestStat, emptyHint, notice: exam408DashNotice(input) };
}

/** 顶部提示条文案：登录 / 本机缓存 / 离线降级（null = 不显示） */
export function exam408DashNotice(input: {
  boardFailure: Exam408FetchFailure | null;
  boardCached?: boolean;
  attemptsSource: Exam408AttemptsSource;
}): string | null {
  const parts: string[] = [];
  if (input.boardCached) parts.push("刷卡统计是上次的离线缓存");
  else if (input.boardFailure === "unauthorized") parts.push("刷卡统计需登录后显示");
  if (input.attemptsSource === "local") parts.push("套卷成绩读取本机记录");
  return parts.length > 0 ? parts.join("；") : null;
}
