import { describe, expect, it } from "vitest";
import { COMPACT_TITLE_END, COMPACT_TITLE_START, compactTitleOpacity } from "./header-compact";

describe("compactTitleOpacity", () => {
  it("页头区间不显示重复标题", () => {
    expect(compactTitleOpacity(0)).toBe(0);
    expect(compactTitleOpacity(COMPACT_TITLE_START)).toBe(0);
  });

  it("滚过标题区后完全显示", () => {
    expect(compactTitleOpacity(COMPACT_TITLE_END)).toBe(1);
    expect(compactTitleOpacity(600)).toBe(1);
  });

  it("中间区间单调过渡且不越界", () => {
    const mid = compactTitleOpacity((COMPACT_TITLE_START + COMPACT_TITLE_END) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(compactTitleOpacity(-20)).toBe(0);
    expect(compactTitleOpacity(Number.NaN)).toBe(0);
  });
});
