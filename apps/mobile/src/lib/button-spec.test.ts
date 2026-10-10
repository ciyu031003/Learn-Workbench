import { describe, it, expect } from "vitest";
import {
  BUTTON_DISABLED_OPACITY,
  BUTTON_SIZES,
  buttonBackground,
  buttonForeground,
  buttonHitSlop,
  buttonIconSize,
  hitSlopForHeight,
  MIN_TOUCH_TARGET,
} from "./button-spec";

const colors = { primary: "#2F74C0", primarySoft: "#E6F0FA", danger: "#D9534F", text: "#1C1C1E" };

describe("buttonBackground", () => {
  it("四个变体各有明确底色，ghost 透明", () => {
    expect(buttonBackground(colors, "primary")).toBe(colors.primary);
    expect(buttonBackground(colors, "secondary")).toBe(colors.primarySoft);
    expect(buttonBackground(colors, "danger")).toBe(colors.danger);
    expect(buttonBackground(colors, "ghost")).toBe("transparent");
  });
});

describe("buttonForeground", () => {
  it("彩色实底用白字（不跟随主题，深色模式才有对比）", () => {
    expect(buttonForeground(colors, "primary")).toBe("#FFFFFF");
    expect(buttonForeground(colors, "danger")).toBe("#FFFFFF");
  });
  it("secondary 用品牌色、ghost 用正文色", () => {
    expect(buttonForeground(colors, "secondary")).toBe(colors.primary);
    expect(buttonForeground(colors, "ghost")).toBe(colors.text);
  });
});

describe("尺寸规格", () => {
  it("md/sm 的图标字号与两边组件口径一致", () => {
    expect(buttonIconSize("md")).toBe(18);
    expect(buttonIconSize("sm")).toBe(16);
    expect(BUTTON_SIZES.md.height).toBe(48);
    expect(BUTTON_SIZES.sm.height).toBe(38);
  });
  it("禁用透明度统一 0.4", () => {
    expect(BUTTON_DISABLED_OPACITY).toBe(0.4);
  });
});

/**
 * 组一 · 阶段 2（真机矩阵）：视觉高度可以小于 44，**触控目标不能**。
 * 真机上「小按钮点不中」的反馈集中在这一档，靠 hitSlop 把可点区域补到 44。
 */
describe("触控热区（44pt）", () => {
  it("下限常量就是 HIG 的 44", () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });

  it("hitSlopForHeight 四周各补到 44，已达标返回 0", () => {
    expect(hitSlopForHeight(38)).toBe(3); // 38 + 3×2 = 44
    expect(hitSlopForHeight(34)).toBe(5); // 34 + 5×2 = 44
    expect(hitSlopForHeight(28)).toBe(8); // 28 + 8×2 = 44
    expect(hitSlopForHeight(44)).toBe(0);
    expect(hitSlopForHeight(48)).toBe(0);
  });

  it("非法高度按 0 处理（宁可给出最大补量，也不要静默放过）", () => {
    expect(hitSlopForHeight(Number.NaN)).toBe(22);
  });

  it("两个尺寸档：md 已达标、sm 补齐后达到 44", () => {
    expect(buttonHitSlop("md")).toBe(0);
    expect(buttonHitSlop("sm") * 2 + BUTTON_SIZES.sm.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});
