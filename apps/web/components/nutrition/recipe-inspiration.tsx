"use client";

import { useMemo, useState } from "react";
import { ChefHat, Clock3, Flame, Wheat } from "lucide-react";
import { GlassModal } from "@/components/ui/modal";
import { mealKindLabels, type MealKind } from "@learn-workbench/shared";
import {
  recipeTagLabels,
  recipesForMeal,
  type Recipe,
} from "@learn-workbench/content";
import { cn } from "@/lib/utils";

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

function Macro({ label, value, unit = "g" }: { label: string; value: number; unit?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/80">{label}</span>
      <span className="tabular-nums">{value}{unit}</span>
    </span>
  );
}

export function RecipeInspiration() {
  const [meal, setMeal] = useState<MealKind>("lunch");
  const [active, setActive] = useState<Recipe | null>(null);
  const recipes = useMemo(() => recipesForMeal(meal, 6), [meal]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <ChefHat className="size-4 text-primary" />
            精选食谱
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            营养为单人份估算，点开查看配料与步骤
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {MEALS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMeal(item)}
              className={cn(
                "press-soft rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                meal === item
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {mealKindLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recipes.map((recipe) => (
          <button
            key={recipe.id}
            type="button"
            onClick={() => setActive(recipe)}
            className="group flex min-h-44 flex-col rounded-lg border border-border/60 bg-surface/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--elev-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{recipe.name}</h3>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {recipe.kcal} kcal
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {recipe.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              <Macro label="蛋白" value={recipe.proteinG} />
              <Macro label="碳水" value={recipe.carbsG} />
              <Macro label="脂肪" value={recipe.fatG} />
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock3 className="size-3" />
                {recipe.prepMinutes + recipe.cookMinutes} 分钟
              </span>
              <div className="flex flex-wrap justify-end gap-1">
                {recipe.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {recipeTagLabels[tag]}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      <GlassModal open={Boolean(active)} onClose={() => setActive(null)} title={active?.name ?? "食谱详情"} className="max-w-xl">
        {active ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{active.summary}</p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: Flame, label: "热量", value: `${active.kcal} kcal` },
                { icon: Wheat, label: "碳水", value: `${active.carbsG} g` },
                { icon: ChefHat, label: "蛋白", value: `${active.proteinG} g` },
                { icon: Clock3, label: "用时", value: `${active.prepMinutes + active.cookMinutes} 分钟` },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2">
                  <item.icon className="mb-1 size-3.5 text-primary" />
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">配料</h3>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {active.ingredients.map((ingredient) => (
                  <div key={ingredient.name} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-xs">
                    <span>{ingredient.name}</span>
                    <span className="shrink-0 text-muted-foreground">{ingredient.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">做法</h3>
              <ol className="flex flex-col gap-2">
                {active.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[10px] font-bold text-primary">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {active.tip ? (
              <p className="rounded-lg border-l-2 border-primary/50 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {active.tip}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {active.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                  {recipeTagLabels[tag]}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </GlassModal>
    </section>
  );
}
