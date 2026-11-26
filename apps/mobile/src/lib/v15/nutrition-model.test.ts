import { describe, expect, it } from "vitest";
import type { MealEntry } from "@learn-workbench/shared/schemas";
import { buildMealSections, kcalDeltaFromYesterday, weekKcalStats } from "./nutrition-model";

function entry(meal: MealEntry["meal"], kcal: number, name = "食物"): MealEntry {
  return {
    id: Math.round(kcal + 1),
    logDate: "2026-11-27",
    meal,
    foodId: null,
    name,
    amount: 1,
    unit: "份",
    kcal,
    proteinG: 10,
    carbsG: 20,
    fatG: 5,
  };
}

describe("v15 nutrition model", () => {
  it("餐次固定按早/午/晚/加排序，并汇总卡路里", () => {
    const rows = buildMealSections([entry("dinner", 500), entry("breakfast", 300), entry("breakfast", 120)]);
    expect(rows.map((row) => row.meal)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    expect(rows[0].kcal).toBe(420);
    expect(rows[0].count).toBe(2);
    expect(rows[1].count).toBe(0);
  });

  it("周统计只按有记录的天算日均，不被 0 拉低", () => {
    const stats = weekKcalStats([{ kcal: 1500 }, { kcal: 0 }, { kcal: 1800 }, { kcal: 0 }]);
    expect(stats.avg).toBe(1650);
    expect(stats.max).toBe(1800);
    expect(stats.recorded).toBe(2);
  });

  it("昨天没有记录时不伪造对比", () => {
    expect(kcalDeltaFromYesterday([], "2026-11-27", 1400)).toBeNull();
    const rows = [
      { date: "2026-11-26", kcal: 1500, entryCount: 2, proteinG: 0, carbsG: 0, fatG: 0 } as never,
    ];
    expect(kcalDeltaFromYesterday(rows, "2026-11-27", 1400)).toBe(-100);
  });
});
