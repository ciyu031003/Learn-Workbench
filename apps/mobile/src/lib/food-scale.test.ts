import { describe, it, expect } from "vitest";
import { formatBasisLabel, scaleFoodByAmount } from "@learn-workbench/shared";

/**
 * v6 P1-3 食物营养基准库：按摄入量换算的契约。
 * 服务端（POST /api/nutrition 的 foodItemId+grams 分支）会独立重算一次，口径必须一致。
 */
const noodle = { kcal: 480, proteinG: 22, carbsG: 65, fatG: 16, basisAmount: 500 };

describe("scaleFoodByAmount", () => {
  it("按基准量等比换算（每 500g 吃 600g → ×1.2）", () => {
    const r = scaleFoodByAmount(noodle, 600);
    expect(r).toEqual({ kcal: 576, proteinG: 26.4, carbsG: 78, fatG: 19.2 });
  });

  it("吃一份（= 基准量）时原样返回", () => {
    expect(scaleFoodByAmount(noodle, 500).kcal).toBe(480);
  });

  it("每 100g 基准同样成立", () => {
    const rice = { kcal: 116, proteinG: 2.6, carbsG: 25.9, fatG: 0.3, basisAmount: 100 };
    expect(scaleFoodByAmount(rice, 250)).toEqual({ kcal: 290, proteinG: 6.5, carbsG: 64.8, fatG: 0.8 });
  });

  it("非法基准/摄入量按 0 处理（不产生 NaN）", () => {
    // 基准量非法（0/NaN）时回落到 100，避免除零；摄入量非法按 0
    expect(scaleFoodByAmount({ ...noodle, basisAmount: 0 }, 100)).toEqual({ kcal: 480, proteinG: 22, carbsG: 65, fatG: 16 });
    expect(scaleFoodByAmount(noodle, -5)).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    expect(scaleFoodByAmount({ kcal: NaN, proteinG: 1, carbsG: 1, fatG: 1, basisAmount: 100 }, 100).kcal).toBe(0);
  });

  it("兼容 node-pg 返回的字符串数值（numeric → string）", () => {
    const fromApi = { kcal: "480", proteinG: "22", carbsG: "65", fatG: "16", basisAmount: "500" };
    expect(scaleFoodByAmount(fromApi as never, 600)).toEqual({ kcal: 576, proteinG: 26.4, carbsG: 78, fatG: 19.2 });
  });

  it("formatBasisLabel 生成「每 500g」文案", () => {
    expect(formatBasisLabel({ basisAmount: 100, basisUnit: "g" })).toBe("每 100g");
    expect(formatBasisLabel({ basisAmount: 1, basisUnit: "份" })).toBe("每 1份");
  });
});
