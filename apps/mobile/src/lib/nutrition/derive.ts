import {
  buildNutritionTargetView,
  nutritionTargetRange,
  sumNutrition,
} from "@learn-workbench/shared/pure";
import { DEFAULT_NUTRITION_TARGETS } from "@learn-workbench/shared/labels";
import type { MacroRingItem } from "@/components/macro-mini-rings";
import type { NutritionProfileDto, NutritionTargetDto } from "@/lib/wellbeing-client";
import { MACRO_COLORS } from "./constants";

/** 有效营养目标（身体数据算出来 / 手动覆盖 / 回落 shared 默认值） */
export interface NutritionTargetView {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  computed: boolean;
  note?: string;
}

/**
 * 目标计算（纯函数，从 nutrition 屏内抽出，便于单测）：
 * - `serverTarget` 里 `computed=false` 且与默认值相同 = 用户没有显式设置 → 视为 null 交给身体数据计算
 * - 身体数据缺失时 buildNutritionTargetView 自己会回落 DEFAULT_NUTRITION_TARGETS
 */
export function computeTarget(
  profile: Partial<NutritionProfileDto> | null,
  serverTarget: NutritionTargetDto | null
): NutritionTargetView {
  const base = buildNutritionTargetView(
    {
      weightKg: profile?.weightKg ?? 60,
      heightCm: profile?.heightCm ?? null,
      birthYear: profile?.birthYear ?? null,
      sex: profile?.sex ?? null,
      activityLevel: profile?.activityLevel ?? null,
    },
    serverTarget
      ? {
          kcal:
            serverTarget.computed || serverTarget.kcal !== DEFAULT_NUTRITION_TARGETS.kcal
              ? serverTarget.kcal
              : null,
          proteinG: serverTarget.proteinG,
          carbsG: serverTarget.carbsG,
          fatG: serverTarget.fatG,
        }
      : null
  );
  return {
    kcal: base.kcal,
    proteinG: base.proteinG,
    carbsG: base.carbsG,
    fatG: base.fatG,
    computed: base.computed,
    note: base.note,
  };
}

/** 三大营养素环的数据（空记录时 value=0，环仍按目标绘制 → 空态可见） */
export function computeMacroItems(
  totals: { proteinG: number; carbsG: number; fatG: number },
  target: Pick<NutritionTargetView, "proteinG" | "carbsG" | "fatG">
): MacroRingItem[] {
  return [
    {
      key: "proteinG",
      label: "蛋白",
      value: totals.proteinG,
      target: target.proteinG,
      range: nutritionTargetRange(target.proteinG),
      color: MACRO_COLORS.proteinG,
    },
    {
      key: "carbsG",
      label: "碳水",
      value: totals.carbsG,
      target: target.carbsG,
      range: nutritionTargetRange(target.carbsG),
      color: MACRO_COLORS.carbsG,
    },
    {
      key: "fatG",
      label: "脂肪",
      value: totals.fatG,
      target: target.fatG,
      range: nutritionTargetRange(target.fatG),
      color: MACRO_COLORS.fatG,
    },
  ];
}

/** 今日汇总（空数组 → 全 0；异常字段按 0 计，避免 NaN 渗进 UI） */
export function computeTotals(entries: Parameters<typeof sumNutrition>[0]): ReturnType<typeof sumNutrition> {
  const safe = Array.isArray(entries) ? entries : [];
  return sumNutrition(safe);
}
