import { describe, expect, test } from "vitest";
import { recipeCatalog, recipeById, recipesForMeal } from "./recipes";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

describe("health recipe catalog", () => {
  test("keeps at least six recipes for every meal and unique ids", () => {
    expect(recipeCatalog.length).toBeGreaterThanOrEqual(24);
    expect(new Set(recipeCatalog.map((recipe) => recipe.id)).size).toBe(recipeCatalog.length);

    for (const meal of MEALS) {
      expect(recipesForMeal(meal, 6)).toHaveLength(6);
    }
  });

  test("all recipes have usable nutrition, ingredients and steps", () => {
    for (const recipe of recipeCatalog) {
      expect(recipe.name.length).toBeGreaterThan(0);
      expect(recipe.summary.length).toBeGreaterThan(0);
      expect(recipe.meals.length).toBeGreaterThan(0);
      expect(recipe.kcal).toBeGreaterThan(0);
      expect(recipe.proteinG).toBeGreaterThanOrEqual(0);
      expect(recipe.carbsG).toBeGreaterThanOrEqual(0);
      expect(recipe.fatG).toBeGreaterThanOrEqual(0);
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(3);
      expect(recipe.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("meal filtering and id lookup stay stable", () => {
    expect(recipesForMeal("breakfast", 3)).toHaveLength(3);
    expect(recipesForMeal("breakfast", 3).every((recipe) => recipe.meals.includes("breakfast"))).toBe(true);
    expect(recipeById("banana-oat-milk")?.name).toBeTruthy();
    expect(recipeById("missing-recipe")).toBeNull();
  });
});
