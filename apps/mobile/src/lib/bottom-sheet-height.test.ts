import { describe, expect, it } from "vitest";
import {
  resolveSheetHeight,
  SHEET_FALLBACK_RATIO,
  SHEET_HARD_MAX_RATIO,
  SHEET_MIN_USABLE_HEIGHT,
} from "./bottom-sheet-height";

/**
 * 底部弹窗高度纯函数单测（P12）。
 *
 * 验收口径：内容少 → 刚好装下（且不滚）；内容多 → 封顶（要滚）；0/NaN/极端值有兜底；
 * 键盘只在压缩上限时生效；`height` 比例从「固定高度」退化为「上限」。
 */

describe("resolveSheetHeight · 内容少", () => {
  it("内容比上限矮：高度=内容高度，不需要滚动", () => {
    const r = resolveSheetHeight({ contentHeight: 320, usableScreen: 800, maxRatio: 0.5 });
    expect(r.height).toBe(320);
    expect(r.cap).toBe(400);
    expect(r.scrollable).toBe(false);
  });

  it("极矮内容也按内容高度（不留 50% 的空白）", () => {
    const r = resolveSheetHeight({ contentHeight: 96, usableScreen: 800, maxRatio: 0.82 });
    expect(r.height).toBe(96);
    expect(r.scrollable).toBe(false);
  });

  it("内容恰好等于上限：不判为溢出（亚像素容差）", () => {
    const r = resolveSheetHeight({ contentHeight: 400, usableScreen: 800, maxRatio: 0.5 });
    expect(r.height).toBe(400);
    expect(r.cap).toBe(400);
    expect(r.scrollable).toBe(false);
  });
});

describe("resolveSheetHeight · 内容多", () => {
  it("超长内容封顶到比例上限并要求滚动", () => {
    const r = resolveSheetHeight({ contentHeight: 2000, usableScreen: 800, maxRatio: 0.5 });
    expect(r.height).toBe(400);
    expect(r.cap).toBe(400);
    expect(r.scrollable).toBe(true);
  });

  it("比例 0.82 的弹窗在小内容时按内容、大内容时封顶 82%", () => {
    const small = resolveSheetHeight({ contentHeight: 300, usableScreen: 900, maxRatio: 0.82 });
    const large = resolveSheetHeight({ contentHeight: 5000, usableScreen: 900, maxRatio: 0.82 });
    expect(small.height).toBe(300);
    expect(small.scrollable).toBe(false);
    expect(large.height).toBeCloseTo(738, 5);
    expect(large.scrollable).toBe(true);
  });

  it("超过上限 1px 即判为需要滚动", () => {
    const r = resolveSheetHeight({ contentHeight: 401, usableScreen: 800, maxRatio: 0.5 });
    expect(r.height).toBe(400);
    expect(r.scrollable).toBe(true);
  });

  it("硬上限 0.94 永不超过（即使 height 传 98%）", () => {
    const r = resolveSheetHeight({ contentHeight: 5000, usableScreen: 800, maxRatio: 0.98 });
    expect(r.height).toBeCloseTo(SHEET_HARD_MAX_RATIO * 800, 5);
    expect(r.height).toBeLessThanOrEqual(800);
  });
});

describe("resolveSheetHeight · 脏值与极端值兜底", () => {
  it("contentHeight 为 0 / 负数 → 取 minHeight 下限", () => {
    expect(resolveSheetHeight({ contentHeight: 0, usableScreen: 800, minHeight: 120 }).height).toBe(120);
    expect(resolveSheetHeight({ contentHeight: -80, usableScreen: 800, minHeight: 120 }).height).toBe(120);
  });

  it("contentHeight 为 NaN/Infinity → 按「未测到」处理，不撑爆也不崩", () => {
    for (const contentHeight of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const r = resolveSheetHeight({ contentHeight, usableScreen: 800, maxRatio: 0.5 });
      expect(r.height).toBe(0);
      expect(r.scrollable).toBe(false);
    }
  });

  it("usableScreen 为 0/NaN → 退化成 minHeight，cap 为 0", () => {
    for (const usableScreen of [0, Number.NaN, -100]) {
      const r = resolveSheetHeight({ contentHeight: 300, usableScreen, minHeight: 80 });
      expect(r.height).toBe(80);
      expect(r.cap).toBe(0);
      expect(r.scrollable).toBe(true);
    }
  });

  it("maxRatio 脏值回落 0.5，越界夹到 0.12–0.98", () => {
    const fallback = resolveSheetHeight({ contentHeight: 9999, usableScreen: 800, maxRatio: Number.NaN });
    expect(fallback.height).toBe(800 * SHEET_FALLBACK_RATIO);
    expect(resolveSheetHeight({ contentHeight: 9999, usableScreen: 800, maxRatio: -3 }).height).toBeCloseTo(800 * 0.12, 5);
    expect(resolveSheetHeight({ contentHeight: 9999, usableScreen: 800, maxRatio: 9 }).height).toBeCloseTo(800 * 0.94, 5);
  });

  it("极矮屏（比最小可用高度还矮）不会算出超过屏幕的高度", () => {
    const r = resolveSheetHeight({ contentHeight: 400, usableScreen: 100, maxRatio: 0.9 });
    expect(r.height).toBeLessThanOrEqual(100);
    expect(r.scrollable).toBe(true);
  });

  it("minHeight 大于上限时被 cap 收住", () => {
    const r = resolveSheetHeight({ contentHeight: 10, usableScreen: 400, maxRatio: 0.5, minHeight: 500 });
    expect(r.height).toBe(200);
  });
});

describe("resolveSheetHeight · 键盘", () => {
  it("键盘把上限压矮，内容被压缩到键盘上方且需要滚动", () => {
    const r = resolveSheetHeight({ contentHeight: 700, usableScreen: 800, maxRatio: 0.82, keyboardHeight: 300 });
    expect(r.cap).toBe(500);
    expect(r.height).toBe(500);
    expect(r.scrollable).toBe(true);
  });

  it("键盘很高时保留最小可用高度（不会压成 0）", () => {
    const r = resolveSheetHeight({ contentHeight: 200, usableScreen: 800, maxRatio: 0.5, keyboardHeight: 900 });
    expect(r.cap).toBe(SHEET_MIN_USABLE_HEIGHT);
    expect(r.height).toBe(SHEET_MIN_USABLE_HEIGHT);
  });

  it("内容比键盘压缩后的上限还矮：高度仍按内容，不强行撑满", () => {
    const r = resolveSheetHeight({ contentHeight: 180, usableScreen: 800, maxRatio: 0.82, keyboardHeight: 300 });
    expect(r.height).toBe(180);
    expect(r.scrollable).toBe(false);
  });
});
