import type { MealEntry, MealKind } from "@learn-workbench/shared/schemas";
import { mealKindLabels } from "@learn-workbench/shared/labels";
import type { DaySummaryRow } from "@/lib/nutrition-views";
import { addDaysKey } from "@/lib/v15/dates";

export const V15_MEAL_ORDER: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

export interface MealSection {
  meal: MealKind;
  label: string;
  kcal: number;
  count: number;
  items: MealEntry[];
}

/** 按餐次分组；保持固定的早/午/晚/加顺序，空餐次也返回（由 UI 决定是否渲染空卡） */
export function buildMealSections(entries: MealEntry[]): MealSection[] {
  return V15_MEAL_ORDER.map((meal) => {
    const items = entries.filter((entry) => entry.meal === meal);
    return {
      meal,
      label: mealKindLabels[meal],
      kcal: items.reduce((sum, entry) => sum + (Number.isFinite(entry.kcal) ? entry.kcal : 0), 0),
      count: items.length,
      items,
    };
  });
}

/** 近 7 天热量统计：日均只按「有记录的天」计算，不用 0 拉低均值 */
export function weekKcalStats(days: { kcal: number }[]): { avg: number; max: number; recorded: number } {
  const values = days.map((day) => (Number.isFinite(day.kcal) ? Math.max(0, day.kcal) : 0));
  const recordedValues = values.filter((value) => value > 0);
  if (recordedValues.length === 0) return { avg: 0, max: 0, recorded: 0 };
  return {
    avg: Math.round(recordedValues.reduce((sum, value) => sum + value, 0) / recordedValues.length),
    max: Math.max(...recordedValues),
    recorded: recordedValues.length,
  };
}

/** 与昨天相比的热量差：任何一天没有记录就返回 null（不拿 0 假装对比） */
export function kcalDeltaFromYesterday(rows: DaySummaryRow[], dateKey: string, todayKcal: number): number | null {
  if (!(todayKcal > 0)) return null;
  const yesterday = rows.find((row) => row.date === addDaysKey(dateKey, -1));
  if (!yesterday || !(yesterday.entryCount > 0) || !(yesterday.kcal > 0)) return null;
  return Math.round(todayKcal - yesterday.kcal);
}
