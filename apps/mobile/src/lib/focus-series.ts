import type { FocusSession } from "@learn-workbench/shared";

/**
 * 学习统计的**纯计算层**（v1.33.0 从 `app/(tabs)/learn.tsx` 抽出）。
 *
 * 抽出原因：① 学习统计要变成**独立全屏页面**，计算不能只活在 hub 页里；
 * ② 放 lib 才能写单测 —— learn.tsx 间接 import 了 react-native，vitest 加载不了（踩坑 48/89）。
 * 所有函数零依赖、可注入数据，UI 只负责把 store 里的 sessions 传进来。
 */

export const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

/** 本地日期键（YYYY-MM-DD）：**不能用 toISOString()**，那会按 UTC 把凌晨的记录算到前一天 */
export function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

export function weekdayName(d: Date): string {
  return WEEKDAY_NAMES[d.getDay()] ?? "";
}

/** 一天里的时段划分（时段柱状图的口径；与「可学习时长分布」热力图无关） */
export const PERIODS = [
  { label: "凌晨", start: 0, end: 6 },
  { label: "清晨", start: 6, end: 9 },
  { label: "上午", start: 9, end: 12 },
  { label: "中午", start: 12, end: 14 },
  { label: "下午", start: 14, end: 18 },
  { label: "晚上", start: 18, end: 22 },
  { label: "深夜", start: 22, end: 24 },
] as const;

/** 每次专注的分钟数（负数/NaN 归一为 0） */
export function sessionMinutes(s: FocusSession): number {
  return Math.max(0, Math.round((s.durationSeconds ?? 0) / 60));
}

/** 日期键 → 当天总分钟数 */
export function buildDayMinutesMap(sessions: FocusSession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = localKey(d);
    map.set(key, (map.get(key) ?? 0) + sessionMinutes(s));
  }
  return map;
}

/** 指定日期（本地）的时段分布柱 */
export function buildPeriodBars(sessions: FocusSession[], key: string): { label: string; value: number }[] {
  const bars = PERIODS.map((p) => ({ label: p.label as string, value: 0 }));
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (Number.isNaN(d.getTime()) || localKey(d) !== key) continue;
    const h = d.getHours();
    const idx = PERIODS.findIndex((p) => h >= p.start && h < p.end);
    if (idx >= 0) bars[idx].value += sessionMinutes(s);
  }
  return bars;
}

/** 以 endDate 结尾的近 14 天折线数据 */
export function buildDailySeries(sessions: FocusSession[], endDate: Date): { label: string; value: number }[] {
  const map = buildDayMinutesMap(sessions);
  const out: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = addDays(endDate, -i);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: map.get(localKey(d)) ?? 0 });
  }
  return out;
}

/**
 * 近 12 周（84 天）热力图：按周分组，最后一周是本周。
 * `now` 可注入（v1.35.0）：与 buildDailySeries 的 endDate 同一口径 —— 测试才能钉死
 * 月末/年末边界，而不是永远"相对今天"。
 */
export function buildHeatmap(sessions: FocusSession[], now: Date = new Date()): { key: string; minutes: number }[][] {
  const map = buildDayMinutesMap(sessions);
  const days: { key: string; minutes: number }[] = [];
  for (let i = 83; i >= 0; i -= 1) {
    const d = addDays(now, -i);
    const key = localKey(d);
    days.push({ key, minutes: map.get(key) ?? 0 });
  }
  const weeks: { key: string; minutes: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** 热力图色阶（0 / <30 / <60 / ≥60 分钟） */
export function heatColor(minutes: number): string {
  if (minutes <= 0) return "#F1E7D4";
  if (minutes < 30) return "#FBE0B3";
  if (minutes < 60) return "#F5A34B";
  return "#E35D2F";
}

/** 热力图色阶图例（与 heatColor 的阈值一一对应，别再各写一份） */
export const HEAT_LEGEND = ["#F1E7D4", "#FBE0B3", "#F5A34B", "#E35D2F"];
