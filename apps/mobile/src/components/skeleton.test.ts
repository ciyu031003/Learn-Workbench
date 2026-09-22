import { describe, expect, it, vi } from "vitest";
import {
  SKELETON_HIGHLIGHT_RATIO,
  SKELETON_LAST_LINE_RATIO,
  SKELETON_OPACITY_MAX,
  SKELETON_OPACITY_MIN,
  SKELETON_SWEEP_MS,
  clampSkeletonLines,
  resolveSkeletonAnimation,
  skeletonHighlightColor,
  skeletonHighlightWidth,
  skeletonOpacityRange,
  skeletonSupportsSweep,
  skeletonSweepDistance,
} from "./skeleton";

/**
 * v13 U1：骨架屏纯函数单测（尺寸/颜色/降级推导）。
 *
 * vitest（node 环境）加载不了 reanimated 的原生 worklets，也拉不动主题 store 背后的
 * 原生 AsyncStorage，所以这里把 reanimated / @/theme / @/lib/motion 全部 mock 掉 ——
 * 被测对象只允许是**纯函数**，不渲染组件。
 */
// react-native 的入口是 Flow 源码，node 环境解析不了，必须整体 mock（看板踩坑点 13 同源问题）
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  View: () => null,
}));
vi.mock("react-native-reanimated", () => ({
  default: { View: () => null },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: unknown) => ({ value }),
  withRepeat: (value: unknown) => value,
  withSequence: (value: unknown) => value,
  withTiming: (value: unknown) => value,
  // skeleton.tsx 会链路加载 @/theme/motion，那里在模块级调用 Easing.bezier
  Easing: { bezier: () => (t: number) => t },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: {}, dark: false, mode: "light" }),
}));
vi.mock("@/lib/motion", () => ({
  useReducedMotion: () => false,
}));

describe("v13 U1 skeleton 纯函数", () => {
  it("clampSkeletonLines：至少 1 行，取整，非法值兜底 1", () => {
    expect(clampSkeletonLines(0)).toBe(1);
    expect(clampSkeletonLines(-3)).toBe(1);
    expect(clampSkeletonLines(3.7)).toBe(3);
    expect(clampSkeletonLines(Number.NaN)).toBe(1);
    expect(clampSkeletonLines(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("高光条宽度 = 容器宽 × 8%，非法/零宽返回 0", () => {
    expect(SKELETON_HIGHLIGHT_RATIO).toBe(0.08);
    expect(skeletonHighlightWidth(300)).toBe(24);
    expect(skeletonHighlightWidth(0)).toBe(0);
    expect(skeletonHighlightWidth(-10)).toBe(0);
    expect(skeletonHighlightWidth(Number.NaN)).toBe(0);
    // 极窄容器至少 1px，否则高光看不见
    expect(skeletonHighlightWidth(3)).toBe(1);
  });

  it("扫光位移 = 容器宽 + 条宽（保证完全离开右边界）", () => {
    expect(skeletonSweepDistance(300)).toBe(324);
    expect(skeletonSweepDistance(0)).toBe(0);
  });

  it("扫光一轮 1.6s，与 Web .shimmer 对齐", () => {
    expect(SKELETON_SWEEP_MS).toBe(1600);
  });

  it("高光颜色：浅色 66% 白，深色档更弱（14%）", () => {
    expect(skeletonHighlightColor(false)).toBe("rgba(255,255,255,0.66)");
    expect(skeletonHighlightColor(true)).toBe("rgba(255,255,255,0.14)");
  });

  it("呼吸区间：播放时 0.45↔0.9，不播放时恒为 1", () => {
    expect(skeletonOpacityRange(true)).toEqual({ min: 0.45, max: 0.9 });
    expect(SKELETON_OPACITY_MIN).toBe(0.45);
    expect(SKELETON_OPACITY_MAX).toBe(0.9);
    expect(skeletonOpacityRange(false)).toEqual({ min: 1, max: 1 });
  });

  it("resolveSkeletonAnimation：display 关闭 / 减弱动态 / 总开关关闭都不播", () => {
    expect(resolveSkeletonAnimation(true, false)).toBe(true);
    expect(resolveSkeletonAnimation(false, false)).toBe(false);
    expect(resolveSkeletonAnimation(true, true)).toBe(false);
    expect(resolveSkeletonAnimation(true, false, false)).toBe(false);
    expect(resolveSkeletonAnimation(false, true, false)).toBe(false);
  });

  it("圆点不做扫光，其余形状都做", () => {
    expect(skeletonSupportsSweep("listItem")).toBe(false);
    expect(skeletonSupportsSweep("line")).toBe(true);
    expect(skeletonSupportsSweep("card")).toBe(true);
    expect(skeletonSupportsSweep("chart")).toBe(true);
    expect(skeletonSupportsSweep("hero")).toBe(true);
  });

  it("最后一行短一截的比例与 Web 的 w-2/3 接近", () => {
    expect(SKELETON_LAST_LINE_RATIO).toBeGreaterThan(0.5);
    expect(SKELETON_LAST_LINE_RATIO).toBeLessThan(0.7);
  });
});
