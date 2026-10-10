import { describe, expect, it, vi } from "vitest";

/**
 * vitest（node 环境）加载不了 reanimated 的原生 worklets；
 * `@/theme/motion` 在模块级调用 `Easing.bezier`，所以必须整体 mock（同 skeleton.test.ts）。
 */
vi.mock("react-native-reanimated", () => ({
  Easing: { bezier: () => (t: number) => t },
}));

import {
  FILTER_BAR_MAX_OPACITY,
  FILTER_BAR_MIN_OPACITY,
  FILTER_BAR_PULSE_MS,
  FILTER_BAR_STATIC_OPACITY,
  initialFilterBarOpacity,
  resolveFilterBarPulse,
} from "./filter-bar-spec";

/**
 * 组一 · 阶段 3（动效预算）：筛选刷新的持续脉冲必须有「减弱动态」降级。
 * 旧实现（jobs / market 各一份）是无条件 `withRepeat(..., -1)`，
 * 开了减弱动态的用户照样看持续闪烁 —— 这就是要防的回归。
 */
describe("resolveFilterBarPulse", () => {
  it("默认（未开减弱动态）脉冲", () => {
    expect(resolveFilterBarPulse(false)).toBe(true);
  });

  it("开启减弱动态 → 不脉冲（改为静态实色条，信息仍然成立）", () => {
    expect(resolveFilterBarPulse(true)).toBe(false);
  });
});

describe("initialFilterBarOpacity", () => {
  it("脉冲时从最小透明度起步；静态时直接给固定值（避免首帧闪一下）", () => {
    expect(initialFilterBarOpacity(true)).toBe(FILTER_BAR_MIN_OPACITY);
    expect(initialFilterBarOpacity(false)).toBe(FILTER_BAR_STATIC_OPACITY);
  });

  it("静态值必须可见：介于最小与最大之间", () => {
    expect(FILTER_BAR_STATIC_OPACITY).toBeGreaterThan(FILTER_BAR_MIN_OPACITY);
    expect(FILTER_BAR_STATIC_OPACITY).toBeLessThanOrEqual(FILTER_BAR_MAX_OPACITY);
  });

  it("节奏沿用旧实现（380ms 一个来回）", () => {
    expect(FILTER_BAR_PULSE_MS).toBe(380);
  });
});
