import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";
import type { StatTileProps, StatTone } from "@/components/v2/charts";
import type { WeekTile } from "@/lib/wellness-week";

/**
 * 成长页 / 数据看板共用的**纯展示辅助**（格式化、日期键窗口、周报四格适配）。
 *
 * 为什么单独成文件：两个页面（(tabs)/wellness.tsx 概览层 + growth-insights.tsx 数据看板）
 * 都要用同一套「日期键 → 星期几」「ISO → HH:mm」「缺数据一律 —」的口径，
 * 复制两份必然漂移。这里零 React / 零 react-native 运行期 import（type-only 除外），
 * 可被 vitest 直接加载（看板踩坑 48）。
 */

/** 无记录的统一占位（与旧版成长页、408 统计同字符） */
export const NO_RECORD = "—";

/** 训练默认目标（分钟）：只用于「运动」完成度的分母，口径与旧版 EXERCISE_TARGET_MIN 一致 */
export const EXERCISE_TARGET_MIN = 30;

/** 「最近一餐」的餐次中文名（与后端 meal_entries.meal 枚举一一对应） */
export const MEAL_LABELS: Record<"breakfast" | "lunch" | "dinner" | "snack", string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

/** 周柱图的星期标签：周一 → 周日（与饮食页 WEEK_TILE_LABELS 同序） */
const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"] as const;

/**
 * 以 todayKey 为终点的 7 个**本地**日期键（today-6 … today）。
 * 与 /api/nutrition/summary?days=7 的窗口完全一致 —— 后端也是「以今天为终点往前 7 天」，
 * 所以柱图能逐日对上，不会出现「周一还显示上上周」的错位。
 */
export function lastSevenKeys(todayKey: string): string[] {
  const base = fromDateKey(todayKey);
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    keys.push(toDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)));
  }
  return keys;
}

/** 日期键 → 单字星期（柱图 x 轴标签） */
export function weekdayShort(dateKey: string): string {
  return WEEKDAY_SHORT[fromDateKey(dateKey).getDay()];
}

/** 保留一位小数（体重 / 变化量） */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** ISO 时刻 → 本地 HH:mm（脏数据返回 null，不抛异常） */
export function clockText(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/** 日期键 → 「11 月 8 日」 */
export function monthDayLabel(key: string): string {
  const d = fromDateKey(key);
  return d.getMonth() + 1 + " 月 " + d.getDate() + " 日";
}

/** lib 只给展示串；图标与语义色调由页面决定（周报四格适配成 StatTile） */
export function weekTile(tile: WeekTile, icon: StatTileProps["icon"], tone: StatTone): StatTileProps {
  return { label: tile.label, value: tile.value, unit: tile.unit, hint: tile.hint, icon, tone };
}
