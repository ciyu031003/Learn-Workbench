import { describe, expect, it } from "vitest";
import {
  MAX_UI_SCALE,
  TEXT_SCALE_POLICY,
  fitsAtMaxScale,
  formatFontScale,
  minTouchboxHeight,
  normalizeFontScale,
  scaledLineHeight,
} from "./text-scale";
import { typography } from "@/theme/tokens";

describe("系统字号倍数展示（设置页实时刷新）", () => {
  it("normalizeFontScale：非法/0/负数一律按 1，正常值原样返回", () => {
    expect(normalizeFontScale(1.3)).toBe(1.3);
    expect(normalizeFontScale(0.85)).toBeCloseTo(0.85);
    expect(normalizeFontScale(0)).toBe(1);
    expect(normalizeFontScale(-2)).toBe(1);
    expect(normalizeFontScale(Number.NaN)).toBe(1);
    expect(normalizeFontScale(Number.POSITIVE_INFINITY)).toBe(1);
    expect(normalizeFontScale(null)).toBe(1);
    expect(normalizeFontScale(undefined)).toBe(1);
  });

  it("formatFontScale：两位小数 + 乘号，兜底同样按 1.00×", () => {
    expect(formatFontScale(1.3)).toBe("1.30×");
    expect(formatFontScale(1)).toBe("1.00×");
    expect(formatFontScale(0.75)).toBe("0.75×");
    expect(formatFontScale(0)).toBe("1.00×");
    expect(formatFontScale(Number.NaN)).toBe("1.00×");
  });
});

describe("v17-A text-scale policy", () => {
  it("紧凑 UI 封顶 130%，正文不封顶", () => {
    expect(MAX_UI_SCALE).toBe(1.3);
    expect(TEXT_SCALE_POLICY.chrome).toEqual({ allowFontScaling: true, maxFontSizeMultiplier: 1.3 });
    expect(TEXT_SCALE_POLICY.body).toEqual({ allowFontScaling: true });
    expect("maxFontSizeMultiplier" in TEXT_SCALE_POLICY.body).toBe(false);
  });

  it("scaledLineHeight 向上取整，非法入参归 0", () => {
    expect(scaledLineHeight(24)).toBe(32); // 24 × 1.3 = 31.2 → 32
    expect(scaledLineHeight(16)).toBe(21); // 20.8 → 21
    expect(scaledLineHeight(0)).toBe(0);
    expect(scaledLineHeight(-5)).toBe(0);
    expect(scaledLineHeight(Number.NaN)).toBe(0);
    expect(scaledLineHeight(24, 1)).toBe(24);
    expect(scaledLineHeight(24, 0)).toBe(32); // 非法乘数回落默认 1.3
  });

  it("fitsAtMaxScale：写死 24 高的单行容器在 130% 下会截断（这正是要抓的坑）", () => {
    expect(fitsAtMaxScale(24, 24, 1)).toBe(false);
    expect(fitsAtMaxScale(31, 24, 1)).toBe(false);
    expect(fitsAtMaxScale(32, 24, 1)).toBe(true);
    expect(fitsAtMaxScale(64, 24, 2)).toBe(true);
    expect(fitsAtMaxScale(63, 24, 2)).toBe(false);
  });

  it("minTouchboxHeight 与 fitsAtMaxScale 自洽", () => {
    const h = minTouchboxHeight(typography.body.lineHeight, 1);
    expect(fitsAtMaxScale(h, typography.body.lineHeight, 1)).toBe(true);
    expect(fitsAtMaxScale(h - 2, typography.body.lineHeight, 1)).toBe(false);
  });
});

describe("v3 type scale (tokens)", () => {
  it("字阶对齐 v3 提案（27/16/15.5/11 字阶）", () => {
    expect(typography.display.fontSize).toBe(30);
    expect(typography.title1.fontSize).toBe(28);
    expect(typography.title2.fontSize).toBe(22);
    expect(typography.headline.fontSize).toBe(17);
    expect(typography.body.fontSize).toBe(15.5);
    expect(typography.callout.fontSize).toBe(15);
    expect(typography.caption.fontSize).toBe(12);
    expect(typography.micro.fontSize).toBe(11);
  });

  it("权重：中文标题 600 比 700 秀气（headline），正文 400", () => {
    expect(typography.display.fontWeight).toBe("800");
    expect(typography.title1.fontWeight).toBe("700");
    expect(typography.headline.fontWeight).toBe("600");
    expect(typography.body.fontWeight).toBe("400");
  });

  it("每一档的 lineHeight 都不小于 fontSize（避免自截断）", () => {
    for (const [name, t] of Object.entries(typography)) {
      expect(t.lineHeight, name).toBeGreaterThanOrEqual(t.fontSize);
    }
  });

  it("字阶随系统放大仍成比例（130% 下正文字号落在可读区间）", () => {
    const scaled = typography.body.fontSize * MAX_UI_SCALE;
    expect(scaled).toBeGreaterThan(16);
    expect(scaled).toBeLessThan(24);
  });
});
