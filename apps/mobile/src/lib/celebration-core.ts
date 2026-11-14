/**
 * 庆祝系统的纯逻辑层（无 React / 无 AsyncStorage，可被 vitest 直接加载）。
 *
 * 为什么要单独一层：
 * 1. 「同一天同一事件只庆祝一次」是产品规则，不是 UI 细节；把 key 的拼法与
 *    去重判定放在纯函数里，才能用单测锁死（尤其是跨天重置与事件隔离）。
 * 2. 弹窗与轻量横幅共用同一套文案模板，避免「今日计划完成」在 A 页面叫
 *    「全部搞定」、B 页面又叫「任务清空」。
 */
export type CelebrationKind =
  | "plan-complete"
  | "chapter-complete"
  | "drill-daily-20"
  | "quiz-milestone"
  | "focus-complete";

export interface CelebrationCopy {
  /** 顶部小字（事件类型） */
  kicker: string;
  title: string;
  subtitle?: string;
  /** 主视觉角标，如 "20" / "92%" */
  badge?: string;
  buttonText: string;
}

export interface CelebrationContext {
  title?: string;
  subtitle?: string;
  badge?: string;
  /** 专注时长（分钟），用于 subtitle 兜底 */
  minutes?: number;
}

export const CELEBRATION_STORAGE_KEY = "learn-workbench.celebration.v1";

/** 本地自然日（YYYY-MM-DD）。业务上按设备本地日切分，跨天自动重新可庆祝。 */
export function celebrationDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function celebrationKey(kind: CelebrationKind, eventId: string, day: string): string {
  return `${kind}:${eventId}:${day}`;
}

/** 事件 key 里不允许出现冒号，否则 "a:b" 与 "a"+"b" 会撞车 */
export function sanitizeEventId(eventId: string): string {
  return String(eventId ?? "").replace(/:/g, "-").trim() || "default";
}

const COPY: Record<
  CelebrationKind,
  (ctx: CelebrationContext) => Omit<CelebrationCopy, "title" | "subtitle" | "badge"> & {
    title: string;
    subtitle: string;
    badge?: string;
  }
> = {
  "plan-complete": (ctx) => ({
    kicker: "今日计划",
    title: ctx.title ?? "今天的计划全部完成",
    subtitle: ctx.subtitle ?? "该做的都做完了，把节奏留给明天。",
    badge: ctx.badge ?? "✓",
    buttonText: "收下这份完成",
  }),
  "chapter-complete": (ctx) => ({
    kicker: "本节完成",
    title: ctx.title ?? "这一节读完了",
    subtitle: ctx.subtitle ?? "已记入学习进度，顺手练两道题会更牢。",
    badge: ctx.badge,
    buttonText: "知道了",
  }),
  "drill-daily-20": (ctx) => ({
    kicker: "408 刷卡",
    title: ctx.title ?? "今日 20 张已完成",
    subtitle: ctx.subtitle ?? "记忆曲线已更新，明天会按计划安排新的卡片。",
    badge: ctx.badge ?? "20",
    buttonText: "明天继续",
  }),
  "quiz-milestone": (ctx) => ({
    kicker: "本组完成",
    title: ctx.title ?? "这一组练完了",
    subtitle: ctx.subtitle ?? "错题已进入复习队列。",
    badge: ctx.badge,
    buttonText: "继续加油",
  }),
  "focus-complete": (ctx) => ({
    kicker: "专注完成",
    title: ctx.title ?? "本轮专注已完成",
    subtitle:
      ctx.subtitle ??
      (ctx.minutes && ctx.minutes > 0 ? `本次专注 ${ctx.minutes} 分钟，已计入今日专注。` : "已计入今日专注。"),
    badge: ctx.badge ?? "✓",
    buttonText: "休息一下",
  }),
};

export function celebrationCopy(kind: CelebrationKind, ctx: CelebrationContext = {}): CelebrationCopy {
  const base = COPY[kind](ctx);
  return {
    kicker: base.kicker,
    title: base.title,
    subtitle: base.subtitle,
    badge: base.badge,
    buttonText: base.buttonText,
  };
}

export type CelebrationLog = Record<string, string>;

/** 只保留当天的记录：庆祝日志不需要历史，剪掉可避免 AsyncStorage 无限增长 */
export function pruneCelebrationLog(log: CelebrationLog, day: string): CelebrationLog {
  const next: CelebrationLog = {};
  for (const [key, value] of Object.entries(log)) {
    if (value === day) next[key] = value;
  }
  return next;
}

/** 宽松解析：历史/损坏数据一律当作空日志，绝不让庆祝功能把页面搞崩 */
export function parseCelebrationLog(raw: string | null | undefined): CelebrationLog {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: CelebrationLog = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") next[key] = value;
    }
    return next;
  } catch {
    return {};
  }
}

/**
 * 尝试占用一个当日事件：
 * - 首次：claimed=true，并把 key 写进日志；
 * - 同一天再次触发：claimed=false（由调用方静默跳过）；
 * - 跨天：旧记录被剪掉，新的一天重新可庆祝。
 */
export function claimCelebrationInLog(
  log: CelebrationLog,
  kind: CelebrationKind,
  eventId: string,
  day: string,
): { claimed: boolean; log: CelebrationLog } {
  const pruned = pruneCelebrationLog(log, day);
  const key = celebrationKey(kind, sanitizeEventId(eventId), day);
  if (pruned[key] === day) return { claimed: false, log: pruned };
  return { claimed: true, log: { ...pruned, [key]: day } };
}
