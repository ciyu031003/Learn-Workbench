import { fromDateKey, toDateKey } from "@learn-workbench/shared";

/**
 * 饮食页「日 / 周 / 月」视图的纯计算（零 react-native import → 可单测，见看板踩坑点 48）。
 *
 * 数据来源：`GET /api/nutrition/summary?days=&end=` 返回的**逐日**行（后端零改动）。
 */

/** 逐日汇总行（与后端 summary 路由的字段一一对应） */
export interface DaySummaryRow {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryCount: number;
}

/** 只保留有记录的天，作为月历徽标与日期条 ✓ 的 map */
export function toDaySummaryMap(rows: unknown): Record<string, DaySummaryRow> {
  const map: Record<string, DaySummaryRow> = {};
  if (!Array.isArray(rows)) return map;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Partial<DaySummaryRow> & { date?: unknown };
    if (typeof r.date !== "string") continue;
    const entryCount = Number(r.entryCount ?? 0);
    if (entryCount <= 0) continue;
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    map[r.date.slice(0, 10)] = {
      date: r.date.slice(0, 10),
      kcal: Math.round(num(r.kcal)),
      proteinG: num(r.proteinG),
      carbsG: num(r.carbsG),
      fatG: num(r.fatG),
      entryCount,
    };
  }
  return map;
}

/** 日 / 周 / 月 视图的区间汇总（周视图与月视图顶部那张卡用它） */
export function summarizeRange(rows: DaySummaryRow[]): {
  kcal: number;
  daysLogged: number;
  avgKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let daysLogged = 0;
  for (const r of rows) {
    if (r.entryCount <= 0) continue;
    daysLogged += 1;
    kcal += r.kcal;
    proteinG += r.proteinG;
    carbsG += r.carbsG;
    fatG += r.fatG;
  }
  return {
    kcal: Math.round(kcal),
    daysLogged,
    avgKcal: daysLogged > 0 ? Math.round(kcal / daysLogged) : 0,
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  };
}

/**
 * 「今天 / 昨天」两个日期键（本地日）。
 * 用 `setDate(-1)` 而不是减 86400000：夏令时切换那天也不会错位。
 */
export function todayAndYesterday(now: Date = new Date()): { today: string; yesterday: string } {
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  y.setDate(y.getDate() - 1);
  return { today: toDateKey(now), yesterday: toDateKey(y) };
}

/** 行标题上的日期文案：今天 / 昨天 / M月D日（跨年补年份） */
export function dayLabel(dateKey: string, todayKey: string): string {
  const { yesterday } = todayAndYesterday(fromDateKey(todayKey));
  if (dateKey === todayKey) return "今天";
  if (dateKey === yesterday) return "昨天";
  const d = fromDateKey(dateKey);
  const sameYear = dateKey.slice(0, 4) === todayKey.slice(0, 4);
  return sameYear ? `${d.getMonth() + 1}月${d.getDate()}日` : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 月历格子里显示的紧凑热量（≥1000 用 k，避免 4 位数挤爆单元格） */
export function compactKcal(kcal: number): string {
  const n = Math.round(Number.isFinite(kcal) ? kcal : 0);
  if (n <= 0) return "";
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

/**
 * 所选日期距离今天「几周之前」（0 = 本周），用于切到「周」视图时把日期条翻到包含它的那一周
 * —— 否则用户在看 8 月的某天时点「周」，日期条会停在今天那周且没有任何格子高亮。
 * 上限由调用方按日期条的能力（4 周）截断。
 */
export function weeksAgo(dateKey: string, todayKey: string, maxWeeks = Number.POSITIVE_INFINITY): number {
  const a = fromDateKey(todayKey).getTime();
  const b = fromDateKey(dateKey).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const days = Math.round((a - b) / 86_400_000);
  if (days <= 0) return 0;
  return Math.min(maxWeeks, Math.floor(days / 7));
}

/**
 * 取出与"当前取数窗口"匹配的区间汇总。
 *
 * 为什么需要它：区间汇总（日 ✓ / 周汇总 / 月历徽标）都来自同一个 `summary?days=&end=` 请求，
 * 而窗口会随视图切换而变化（日=1、周=28、月=当月天数）。切换瞬间旧窗口的数据还在内存里，
 * 直接渲染就会出现"月历一个徽标都没有，却显示本月记录了 1 天"这种串窗口的数字。
 * 返回 null 表示"当前窗口还没有数据"，消费方应显示为空/加载态。
 */
export function pickWindowSummary<T>(
  state: { key: string; map: Record<string, T> },
  windowKey: string
): Record<string, T> | null {
  if (!windowKey || state.key !== windowKey) return null;
  return state.map;
}