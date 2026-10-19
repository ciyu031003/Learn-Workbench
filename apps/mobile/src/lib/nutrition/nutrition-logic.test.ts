import { describe, expect, it } from "vitest";
import { DEFAULT_NUTRITION_TARGETS } from "@learn-workbench/shared/labels";
import {
  lastPortionOf,
  parsePortionMemo,
  portionOptions,
  PORTION_MEMO_KEY,
} from "./portion-memo";
import { computeMacroItems, computeTarget, computeTotals } from "./derive";

describe("computeTarget（目标计算）", () => {
  it("无身体数据、无服务端目标 → 回落 shared 默认 kcal（三大营养素按公式推导，不小于 0）", () => {
    const t = computeTarget(null, null);
    expect(t.kcal).toBe(DEFAULT_NUTRITION_TARGETS.kcal);
    expect(t.proteinG).toBeGreaterThan(0);
    expect(t.computed).toBe(false);
  });

  it("手动覆盖 kcal → 采用服务端值", () => {
    const t = computeTarget(null, {
      kcal: 1800,
      proteinG: 120,
      carbsG: 200,
      fatG: 60,
      computed: false,
    } as never);
    expect(t.kcal).toBe(1800);
    expect(t.proteinG).toBe(120);
  });

  it("computed=true 时即使等于默认值也视为「按身体数据算」", () => {
    const t = computeTarget(
      { weightKg: 70, heightCm: 175, birthYear: 1998, sex: "male", activityLevel: "moderate" } as never,
      { kcal: 2200, proteinG: 130, carbsG: 240, fatG: 70, computed: true } as never
    );
    expect(t.kcal).toBe(2200);
    expect(t.computed).toBe(true);
  });
});

describe("computeMacroItems（换算 + 空态）", () => {
  it("空记录：value 全 0，但环仍按目标绘制（空态可见）", () => {
    const items = computeMacroItems({ proteinG: 0, carbsG: 0, fatG: 0 }, { proteinG: 120, carbsG: 200, fatG: 60 });
    expect(items.map((i) => i.value)).toEqual([0, 0, 0]);
    expect(items.map((i) => i.target)).toEqual([120, 200, 60]);
    expect(items.every((i) => i.range)).toBe(true);
  });

  it("目标为 0（异常/未初始化）不抛错", () => {
    expect(() => computeMacroItems({ proteinG: 1, carbsG: 2, fatG: 3 }, { proteinG: 0, carbsG: 0, fatG: 0 })).not.toThrow();
  });

  it("computeTotals：空数组 → 全 0，不做 NaN 运算", () => {
    const t = computeTotals([]);
    expect(t.kcal).toBe(0);
    expect(t.proteinG).toBe(0);
  });
});

describe("portionOptions（单位换算）", () => {
  it("质量单位按 50/100/150/200 克/毫升", () => {
    expect(portionOptions({ unit: "g" }).map((o) => o.value)).toEqual([50, 100, 150, 200]);
    expect(portionOptions({ unit: "ml" }).map((o) => o.value)).toEqual([50, 100, 150, 200]);
    expect(portionOptions({ unit: "克" }).map((o) => o.value)).toEqual([50, 100, 150, 200]);
  });

  it("计数单位按 0.5/1/1.5/2 份", () => {
    expect(portionOptions({ unit: "份" }).map((o) => o.value)).toEqual([0.5, 1, 1.5, 2]);
    expect(portionOptions({ unit: "个" }).map((o) => o.value)).toEqual([0.5, 1, 1.5, 2]);
  });

  it("异常输入（空/空白/缺失单位）回落到「份」，不抛错", () => {
    expect(portionOptions({ unit: "" })[1].label).toBe("1 份");
    expect(portionOptions({ unit: "   " })[1].label).toBe("1 份");
    expect(portionOptions({} as { unit: string })[1].label).toBe("1 份");
  });
});

describe("parsePortionMemo（本机记忆：异常输入）", () => {
  it("空/非 JSON/非对象 → 空表", () => {
    expect(parsePortionMemo(null)).toEqual({});
    expect(parsePortionMemo("")).toEqual({});
    expect(parsePortionMemo("not-json")).toEqual({});
    expect(parsePortionMemo("[]")).toEqual({});
    expect(parsePortionMemo("123")).toEqual({});
  });

  it("过滤非法量/空名字，单位缺失回落「份」", () => {
    const raw = JSON.stringify({
      " 米饭 ": { amount: 150, unit: "g" },
      "": { amount: 1, unit: "份" },
      bad: { amount: -1, unit: "份" },
      nan: { amount: "abc", unit: "份" },
      nounit: { amount: 2 },
    });
    expect(parsePortionMemo(raw)).toEqual({
      米饭: { amount: 150, unit: "g" },
      nounit: { amount: 2, unit: "份" },
    });
  });

  it("lastPortionOf：有记忆用记忆，没有按 1 个默认单位", () => {
    const memo = { 米饭: { amount: 150, unit: "g" } };
    expect(lastPortionOf(memo, { name: "米饭", unit: "g" })).toEqual({ amount: 150, unit: "g" });
    expect(lastPortionOf(memo, { name: " 面条 ", unit: "份" })).toEqual({ amount: 1, unit: "份" });
  });

  it("存储键固定（改名会丢掉用户本机记忆）", () => {
    expect(PORTION_MEMO_KEY).toBe("lwb.nutrition.last-portion.v1");
  });
});
