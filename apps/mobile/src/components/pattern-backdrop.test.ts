import { describe, expect, it, vi } from "vitest";
import {
  PATTERN_DARK_SCALE,
  PATTERN_MAX_OPACITY,
  PATTERN_TILE,
  clampPatternOpacity,
  patternLayers,
} from "./pattern-backdrop";

/**
 * v13 U12：底纹纯函数单测（不透明度守门 + 深浅两档差异）。
 * 同样需要 mock 原生模块（react-native / reanimated / AsyncStorage / 主题）。
 */
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  View: () => null,
}));
vi.mock("react-native-reanimated", () => ({
  default: { View: () => null },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: unknown) => ({ value }),
  withTiming: (value: unknown) => value,
  Easing: { bezier: () => (t: number) => t },
}));
vi.mock("react-native-svg", () => ({
  default: () => null,
  Defs: () => null,
  Path: () => null,
  Pattern: () => null,
  Rect: () => null,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: {}, dark: false, mode: "light" }),
}));

const palette = {
  accent: "#F28C28",
  warning: "#D99000",
  teal: "#2FB3A6",
  coral: "#F26B5E",
  textFaint: "#A0998A",
  textMuted: "#7A7367",
} as never;

describe("v13 U12 pattern 纯函数", () => {
  it("平铺单元 48px，不透明度上限 7%", () => {
    expect(PATTERN_TILE).toBe(48);
    expect(PATTERN_MAX_OPACITY).toBe(0.07);
  });

  it("clampPatternOpacity：落在 0–7%，非法值归零", () => {
    expect(clampPatternOpacity(0.04)).toBe(0.04);
    expect(clampPatternOpacity(0.9)).toBe(PATTERN_MAX_OPACITY);
    expect(clampPatternOpacity(-1)).toBe(0);
    expect(clampPatternOpacity(Number.NaN)).toBe(0);
  });

  it("所有底纹层都在 3%–7% 内（深色档更弱）", () => {
    for (const variant of ["bauhaus", "chevron"] as const) {
      for (const layer of patternLayers(palette, variant, false)) {
        expect(layer.opacity).toBeGreaterThanOrEqual(0.03);
        expect(layer.opacity).toBeLessThanOrEqual(PATTERN_MAX_OPACITY);
      }
      for (const layer of patternLayers(palette, variant, true)) {
        expect(layer.opacity).toBeLessThanOrEqual(0.035);
      }
    }
  });

  it("深色档 = 浅色档 × 0.5", () => {
    expect(PATTERN_DARK_SCALE).toBe(0.5);
    const light = patternLayers(palette, "bauhaus", false);
    const dark = patternLayers(palette, "bauhaus", true);
    expect(dark.length).toBe(light.length);
    dark.forEach((layer, i) => {
      expect(layer.opacity).toBeCloseTo(light[i].opacity * PATTERN_DARK_SCALE, 6);
    });
  });
});
