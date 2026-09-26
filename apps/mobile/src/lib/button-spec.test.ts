import { describe, it, expect } from "vitest";
import {
  BUTTON_DISABLED_OPACITY,
  BUTTON_SIZES,
  buttonBackground,
  buttonForeground,
  buttonIconSize,
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
