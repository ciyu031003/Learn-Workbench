import { describe, it, expect } from "vitest";
import { STAGGER_MAX, STAGGER_STEP, shouldStagger, staggerDelay } from "./stagger";

describe("staggerDelay", () => {
  it("第 0 项无延迟，逐项递增", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(40);
    expect(staggerDelay(3)).toBe(120);
  });
  it("按 12 项封顶：第 11 项之后不再增大（长列表不会越等越久）", () => {
    expect(staggerDelay(STAGGER_MAX - 1)).toBe(40 * (STAGGER_MAX - 1));
    expect(staggerDelay(STAGGER_MAX)).toBe(40 * (STAGGER_MAX - 1));
    expect(staggerDelay(500)).toBe(40 * (STAGGER_MAX - 1));
  });
  it("步长来自 token（motion.stagger = 40），不是本文件另立一套", () => {
    expect(STAGGER_STEP).toBe(40);
    expect(staggerDelay(2)).toBe(STAGGER_STEP * 2);
  });
  it("可自定义步长", () => {
    expect(staggerDelay(2, 25)).toBe(50);
  });
  it("容错：负数/NaN/小数不产生 NaN", () => {
    expect(staggerDelay(-3)).toBe(0);
    expect(staggerDelay(Number.NaN)).toBe(0);
    expect(staggerDelay(2.7)).toBe(80);
  });
});

describe("shouldStagger", () => {
  it("单项列表不做入场动画", () => {
    expect(shouldStagger(0, 1)).toBe(false);
  });
  it("超过上限的项不参与", () => {
    expect(shouldStagger(STAGGER_MAX, 20)).toBe(false);
    expect(shouldStagger(STAGGER_MAX - 1, 20)).toBe(true);
  });
});
