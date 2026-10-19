import type { ThemeColors } from "@/theme/tokens";
import type { MealKind } from "@learn-workbench/shared/schemas";

/** v4 P4-a：日期视图（日 / 周 / 月） */
export type ViewMode = "day" | "week" | "month";

/** 餐次（与 shared 的 MealKind 对齐；渲染顺序固定：早/午/晚/加餐） */
export const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

/** 三大营养素环的配色（借 吃一点：绿=达标、橙=碳水、青=脂肪） */
export const MACRO_COLORS = { proteinG: "#3DA35D", carbsG: "#F28C28", fatG: "#2FB3A6" } as const;

/** 餐次语义色（与 meal-card-grid 同一套口径；饮食页的推荐卡复用同一色系） */
export function mealAccentColor(meal: MealKind, colors: ThemeColors): string {
  switch (meal) {
    case "breakfast":
      return colors.accent;
    case "lunch":
      return colors.primary;
    case "dinner":
      return colors.lavender;
    case "snack":
      return colors.success;
  }
}

/** 折叠栏展开态的初始值：只有第一组（常用食物）默认展开，其余收起（需求 1） */
export const INITIAL_OPEN_GROUPS: Record<string, boolean> = { common: true };
