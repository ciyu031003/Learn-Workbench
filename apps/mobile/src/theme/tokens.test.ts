import { describe, it, expect } from "vitest";
import { palettes } from "./tokens";

const light = palettes.light;
const dark = palettes.dark;

/**
 * v18：新增「次级正文」灰阶。
 * 背景：此前灰阶只有 textMuted（浅色对白底约 3.0）与 text（约 15.6）两档、中间为空，
 * 导致 >=15pt 的次要正文要么对比度不达标（WCAG AA 正文 4.5）、要么被迫用 text 而丢掉层级。
 */
describe("textSecondary 灰阶", () => {
  it("两套主题都有该档，且不复用别的档位", () => {
    expect(light.textSecondary).toBeTruthy();
    expect(dark.textSecondary).toBeTruthy();
    expect(light.textSecondary).not.toBe(light.text);
    expect(light.textSecondary).not.toBe(light.textMuted);
    expect(dark.textSecondary).not.toBe(dark.textMuted);
  });

  it("浅色档对白底与画布满足 WCAG AA 正文对比度（>= 4.5）", () => {
    const lum = (hex: string) => {
      const h = hex.replace("#", "");
      const c = [0, 2, 4].map((i) => {
        const v = parseInt(h.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    expect(ratio(light.textSecondary, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(light.textSecondary, light.canvas)).toBeGreaterThanOrEqual(4.5);
  });
});
