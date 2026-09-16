import { toDateKey } from "@learn-workbench/shared";

/**
 * 月历的纯逻辑（零 react-native import，因此可以直接写 vitest —— 见看板踩坑点 48）。
 *
 * 从 `app/learn.tsx` 里内联的 `monthGrid` 迁移而来，行为保持不变：
 * 周日为第一列（中文习惯「日一二三四五六」），前置补空、尾部补齐到 7 的倍数。
 */

/** 某年某月的天数（month 为 0 基；闰年 2 月 = 29） */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 整月网格：weekday 前补 null、月末补齐到 7 的倍数，便于直接 `flexWrap` 排成日历。
 * 每个格子是**本地 00:00** 的 Date（与 `toDateKey` 的本地日语义一致，避免跨时区错位）。
 */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const total = daysInMonth(year, month);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** 相邻月份（delta 可为负；自动跨年） */
export function shiftMonth(view: { y: number; m: number }, delta: number): { y: number; m: number } {
  const raw = view.y * 12 + view.m + delta;
  return { y: Math.floor(raw / 12), m: ((raw % 12) + 12) % 12 };
}

/**
 * 月视图的数据窗口 —— 直接喂给 `GET /api/nutrition/summary?days=&end=`。
 *
 * `end` 取**该月最后一天**（而不是今天）：这样翻到历史月份时不会把上个月的尾巴算进来，
 * 也不会因为 `days` 固定 31 而在 2 月/小月多带出前一月的数据（后端 MAX_DAYS=31，正好覆盖整月）。
 */
export function monthRange(year: number, month: number): { days: number; end: string } {
  const days = daysInMonth(year, month);
  return { days, end: toDateKey(new Date(year, month, days)) };
}
