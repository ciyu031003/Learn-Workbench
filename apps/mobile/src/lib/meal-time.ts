import type { MealKind } from "@learn-workbench/shared";

/**
 * 按当前时间推断默认餐次（v6 P1-2）。
 *
 * 边界：<10 点 = 早餐；10:00-14:59 = 午餐；15:00-20:59 = 晚餐；其余（21 点后与凌晨）= 加餐。
 * 纯函数（`now` 可注入便于单测）；屏幕只负责传 `new Date()`。
 */
export function mealForNow(now: Date = new Date()): MealKind {
  const h = now.getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}
