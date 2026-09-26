import { describe, it, expect } from "vitest";
import { readableAccent } from "./habit-accent";

const FALLBACK = "#2F74C0";

describe("readableAccent", () => {
  it("空值 / 非法值回落主题色", () => {
    expect(readableAccent("", FALLBACK)).toBe(FALLBACK);
    expect(readableAccent(null, FALLBACK)).toBe(FALLBACK);
    expect(readableAccent(undefined, FALLBACK)).toBe(FALLBACK);
    expect(readableAccent("not-a-color", FALLBACK)).toBe(FALLBACK);
    expect(readableAccent("#12345", FALLBACK)).toBe(FALLBACK);
    expect(readableAccent("#GGGGGG", FALLBACK)).toBe(FALLBACK);
  });

  it("过亮颜色回落，避免渲染成白条 / 白光", () => {
    expect(readableAccent("#FFFFFF", FALLBACK)).toBe(FALLBACK);
    expect(readableAccent("#FFF", FALLBACK)).toBe(FALLBACK);
    expect(readableAccent("#F8F8F8", FALLBACK)).toBe(FALLBACK);
  });

  it("正常颜色原样返回（含 3 位缩写、大小写、前后空格）", () => {
    expect(readableAccent("#2FB3A6", FALLBACK)).toBe("#2FB3A6");
    expect(readableAccent("#2fb3a6", FALLBACK)).toBe("#2fb3a6");
    expect(readableAccent("#0A0", FALLBACK)).toBe("#0A0");
    expect(readableAccent("  #2FB3A6  ", FALLBACK)).toBe("#2FB3A6");
  });

  it("阈值边界：0.62 不算过亮（> 才回落）", () => {
    // #9E9E9E ≈ 0.6196 → 保留；#A0A0A0 ≈ 0.6275 → 回落
    expect(readableAccent("#9E9E9E", FALLBACK)).toBe("#9E9E9E");
    expect(readableAccent("#A0A0A0", FALLBACK)).toBe(FALLBACK);
  });
});
