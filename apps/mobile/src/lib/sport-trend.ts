import type { ExerciseType } from "@learn-workbench/shared/schemas";
import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";

/**
 * 运动趋势的**纯计算**（零 react-native import → 可单测，见看板踩坑 48）。
 *
 * 数据来源是本地 store 的 `sports: LocalSportLog[]`（计时结束写入的 `createdAt` 是 ISO 字符串）。
 * 这里只做三件事：
 *  1. 按**本地日**归组（`toDateKey`，不用 UTC，跨时区不会把晚上的运动算到第二天）；
 *  2. 给出最近 N 天（7 / 30）的每日时长与次数，供柱状图直接画；
 *  3. 按运动大类（ExerciseType）汇总，供"分组显示/按类型切换"用。
 *
 * 为什么单独一个 lib 而不是写在组件里：本地日志的日期归组、越界过滤、类型筛选
 * 全是边界条件（ISO 解析失败、跨年、筛选后类型列表不能"自己筛没"），值得单测。
 */

/** 筛选：`"ALL"` = 不筛，其余按 ExerciseType 过滤 */
export type SportTrendFilter = ExerciseType | "ALL";

/** 与 store 的 `LocalSportLog` 结构对齐（此处不 import store，避免把 AsyncStorage 拖进单测） */
export interface SportLogLike {
  sportKey: string;
  name?: string;
  type: ExerciseType;
  minutes: number;
  /** ISO 时间戳（`LocalSportLog.createdAt`） */
  createdAt: string;
}

export interface SportTrendPoint {
  /** YYYY-MM-DD（本地日） */
  key: string;
  /** 横轴标签：窗口 ≤10 天用星期，否则用 M/D */
  label: string;
  minutes: number;
  sessions: number;
}

export interface SportTypeTotal {
  type: ExerciseType;
  minutes: number;
  sessions: number;
}

export interface SportTrendSeries {
  /** 从早到晚的 N 天（最后一项 = endKey） */
  points: SportTrendPoint[];
  totalMinutes: number;
  /** 记录条数（同一项目记两次算两次） */
  totalSessions: number;
  /** 有记录的天数 */
  activeDays: number;
  peakKey: string | null;
  peakMinutes: number;
  /** 窗口内**全部**类型的汇总（不受 filter 影响），新→旧按时长降序 */
  byType: SportTypeTotal[];
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 从日期键往前/后推 n 天（本地日语义，跨夏令时不错位） */
function shiftKey(key: string, deltaDays: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + deltaDays);
  return toDateKey(d);
}

/** ISO 时间戳 → 本地日期键；非法时间返回 null（单条脏数据不该让整张图消失） */
export function sportLogDateKey(log: SportLogLike): string | null {
  const d = new Date(log.createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

/**
 * 最近 `days` 天（含 endKey 当天）的运动时长序列。
 *
 * `filter` 只影响每日序列与合计；`byType` 始终按窗口内全部记录统计 ——
 * 否则用户点了「力量」后，其他类型的入口就消失了，没法再切回去（交互死锁）。
 */
export function buildSportTrend(
  logs: SportLogLike[],
  endKey: string,
  days = 7,
  filter: SportTrendFilter = "ALL"
): SportTrendSeries {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days) || 7));
  const startKey = shiftKey(endKey, -(safeDays - 1));

  const buckets = new Map<string, { minutes: number; sessions: number }>();
  const typeBuckets = new Map<ExerciseType, { minutes: number; sessions: number }>();
  let totalMinutes = 0;
  let totalSessions = 0;

  for (const log of logs) {
    const key = sportLogDateKey(log);
    if (!key || key < startKey || key > endKey) continue;
    const minutes = Math.max(0, Math.round(Number(log.minutes) || 0));

    const tb = typeBuckets.get(log.type) ?? { minutes: 0, sessions: 0 };
    tb.minutes += minutes;
    tb.sessions += 1;
    typeBuckets.set(log.type, tb);

    if (filter !== "ALL" && log.type !== filter) continue;
    const b = buckets.get(key) ?? { minutes: 0, sessions: 0 };
    b.minutes += minutes;
    b.sessions += 1;
    buckets.set(key, b);
    totalMinutes += minutes;
    totalSessions += 1;
  }

  const points: SportTrendPoint[] = [];
  for (let i = 0; i < safeDays; i += 1) {
    const key = shiftKey(startKey, i);
    const b = buckets.get(key) ?? { minutes: 0, sessions: 0 };
    const d = fromDateKey(key);
    points.push({
      key,
      label: safeDays <= 10 ? WEEKDAY_LABELS[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: b.minutes,
      sessions: b.sessions,
    });
  }

  let peakKey: string | null = null;
  let peakMinutes = 0;
  for (const p of points) {
    if (p.minutes > peakMinutes) {
      peakMinutes = p.minutes;
      peakKey = p.key;
    }
  }

  const byType: SportTypeTotal[] = [...typeBuckets.entries()]
    .map(([type, v]) => ({ type, minutes: v.minutes, sessions: v.sessions }))
    .sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions || a.type.localeCompare(b.type));

  return {
    points,
    totalMinutes,
    totalSessions,
    activeDays: points.filter((p) => p.sessions > 0).length,
    peakKey,
    peakMinutes,
    byType,
  };
}

/** 运动时长文案：`90 → "1 小时 30 分"`、`0 → "0 分钟"`（shared 的 formatDuration 会输出 "1 小时 0 分"） */
export function formatSportDuration(minutes: number): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h} 小时 ${m} 分`;
  if (h > 0) return `${h} 小时`;
  return `${m} 分钟`;
}
