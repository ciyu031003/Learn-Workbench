import { describe, expect, it } from "vitest";
import { DEFAULT_ROOT_MARGIN, normalizeRootMargin, shouldMountImmediately } from "./lazy-visibility";

describe("shouldMountImmediately", () => {
  it("只有显式 disabled 才立即挂载", () => {
    expect(shouldMountImmediately({ disabled: true })).toBe(true);
    expect(shouldMountImmediately({ disabled: false })).toBe(false);
    expect(shouldMountImmediately({})).toBe(false);
    expect(shouldMountImmediately()).toBe(false);
  });
});

describe("normalizeRootMargin", () => {
  it("空值回退默认 rootMargin", () => {
    expect(normalizeRootMargin()).toBe(DEFAULT_ROOT_MARGIN);
    expect(normalizeRootMargin(null)).toBe(DEFAULT_ROOT_MARGIN);
    expect(normalizeRootMargin("")).toBe(DEFAULT_ROOT_MARGIN);
    expect(normalizeRootMargin("   ")).toBe(DEFAULT_ROOT_MARGIN);
  });

  it("保留合法值并 trim", () => {
    expect(normalizeRootMargin(" 300px ")).toBe("300px");
    expect(normalizeRootMargin("0px 0px 200px 0px")).toBe("0px 0px 200px 0px");
  });
});
