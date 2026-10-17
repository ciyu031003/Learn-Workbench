import { describe, expect, it } from "vitest";
import {
  RECIPE_IDEAS,
  RECIPE_MEALS,
  dailyRecipes,
  dayNumber,
  hashSeed,
  pickRecipesForDate,
  recipeIdeaById,
  seededShuffle,
} from "./recipes";

/** 连续日期（用 UTC 拼接，避免本地时区把日期串算错） */
function nextDays(start: string, n: number): string[] {
  const base = Date.parse(start + "T00:00:00Z");
  return Array.from({ length: n }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10));
}

describe("食谱池（需求 2：至少 24 条，覆盖早/午/晚/加餐）", () => {
  it("条数、id 与名称唯一", () => {
    expect(RECIPE_IDEAS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(RECIPE_IDEAS.map((r) => r.id)).size).toBe(RECIPE_IDEAS.length);
    expect(new Set(RECIPE_IDEAS.map((r) => r.name)).size).toBe(RECIPE_IDEAS.length);
  });

  it("四个餐次都覆盖到（每餐次至少 5 条，轮换才有意义）", () => {
    for (const meal of RECIPE_MEALS) {
      expect(RECIPE_IDEAS.filter((r) => r.meals.includes(meal)).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("每条都带热量与三大营养素，且与 4P+4C+9F 自洽（±15%）", () => {
    for (const r of RECIPE_IDEAS) {
      expect(r.kcal).toBeGreaterThan(0);
      expect(r.proteinG).toBeGreaterThanOrEqual(0);
      expect(r.carbsG).toBeGreaterThanOrEqual(0);
      expect(r.fatG).toBeGreaterThanOrEqual(0);
      expect(r.minutes).toBeGreaterThan(0);
      expect(r.tag.trim().length).toBeGreaterThan(0);
      const derived = r.proteinG * 4 + r.carbsG * 4 + r.fatG * 9;
      expect(Math.abs(derived - r.kcal) / r.kcal).toBeLessThanOrEqual(0.15);
    }
  });

  it("recipeIdeaById 命中与未命中", () => {
    expect(recipeIdeaById(RECIPE_IDEAS[0].id)?.name).toBe(RECIPE_IDEAS[0].name);
    expect(recipeIdeaById("not-exist")).toBeNull();
  });
});

describe("按日期确定性取数（同一天稳定、跨天变化，不用 Math.random）", () => {
  it("hashSeed / dayNumber 稳定且可复现", () => {
    expect(hashSeed("2026-10-17")).toBe(hashSeed("2026-10-17"));
    expect(hashSeed("2026-10-17")).not.toBe(hashSeed("2026-10-18"));
    expect(dayNumber("2026-10-17") - dayNumber("2026-10-16")).toBe(1);
    expect(dayNumber("")).toBe(0);
    expect(dayNumber("2026-13-99")).not.toBeNaN();
  });

  it("seededShuffle：同 seed 同顺序、不改入参", () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(src, 42);
    const b = seededShuffle(src, 42);
    expect(a).toEqual(b);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a.slice().sort((x, y) => x - y)).toEqual(src);
  });

  it("dailyRecipes：每个餐次一条、顺序固定、同一天两次调用完全一致", () => {
    const day = "2026-10-17";
    const first = dailyRecipes(day);
    const second = dailyRecipes(day);
    expect(first).toEqual(second);
    expect(first.map((d) => d.meal)).toEqual(RECIPE_MEALS);
    for (const item of first) {
      expect(item.recipe.meals).toContain(item.meal);
    }
  });

  it("dailyRecipes：跨天会换菜（连续 14 天，每个餐次至少出现 3 种不同食谱）", () => {
    const days = nextDays("2026-10-17", 14);
    for (const meal of RECIPE_MEALS) {
      const picked = new Set(days.map((d) => dailyRecipes(d).find((x) => x.meal === meal)?.recipe.id));
      expect(picked.size).toBeGreaterThanOrEqual(3);
    }
    // 相邻两天整组推荐不会完全一样
    for (let i = 1; i < days.length; i += 1) {
      const prev = dailyRecipes(days[i - 1]).map((x) => x.recipe.id).join(",");
      const curr = dailyRecipes(days[i]).map((x) => x.recipe.id).join(",");
      expect(curr).not.toBe(prev);
    }
  });

  it("pickRecipesForDate：条数、去重、稳定与跨天变化", () => {
    const day = "2026-10-17";
    const picks = pickRecipesForDate(day, 5);
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((p) => p.id)).size).toBe(5);
    expect(pickRecipesForDate(day, 5)).toEqual(picks);
    expect(pickRecipesForDate("2026-10-18", 5).map((p) => p.id)).not.toEqual(picks.map((p) => p.id));
    for (const p of picks) expect(RECIPE_IDEAS.some((r) => r.id === p.id)).toBe(true);
  });

  it("pickRecipesForDate：count 超过池子大小时按池子截断且不重复", () => {
    const all = pickRecipesForDate("2026-10-17", RECIPE_IDEAS.length + 10);
    expect(all).toHaveLength(RECIPE_IDEAS.length);
    expect(new Set(all.map((r) => r.id)).size).toBe(RECIPE_IDEAS.length);
    expect(pickRecipesForDate("2026-10-17", 0)).toEqual([]);
    expect(pickRecipesForDate("2026-10-17", 3, [])).toEqual([]);
  });

  it("自定义池子同样按日期轮换", () => {
    const pool = RECIPE_IDEAS.filter((r) => r.meals.includes("snack"));
    const a = dailyRecipes("2026-10-17", pool);
    const b = dailyRecipes("2026-10-18", pool);
    expect(a.map((x) => x.recipe.id)).not.toEqual(b.map((x) => x.recipe.id));
    for (const item of a) expect(pool.some((p) => p.id === item.recipe.id)).toBe(true);
  });
});
