import { describe, expect, it } from "vitest";
import { celebrationSummary, celebrationTier, celebrationTone } from "./celebration-copy";

describe("庆祝弹窗分档（正确率 → 文案/配色）", () => {
  it("四档阈值：100 / ≥80 / ≥60 / 其余", () => {
    expect(celebrationTier(100)).toBe("perfect");
    expect(celebrationTier(99)).toBe("great");
    expect(celebrationTier(80)).toBe("great");
    expect(celebrationTier(79)).toBe("pass");
    expect(celebrationTier(60)).toBe("pass");
    expect(celebrationTier(59)).toBe("retry");
    expect(celebrationTier(0)).toBe("retry");
  });

  it("非法输入按 0 处理（不炸）", () => {
    expect(celebrationTier(Number.NaN)).toBe("retry");
    // 非有限值一律按 0 处理（宁可给"加油"，也不要给假的"完美通关"）
    expect(celebrationTier(Number.POSITIVE_INFINITY)).toBe("retry");
  });

  it("不同档位的文案与配色确实不同（不能是同一套）", () => {
    const tones = [100, 85, 70, 30].map((p) => celebrationTone(p));
    expect(new Set(tones.map((t) => t.tier)).size).toBe(4);
    expect(new Set(tones.map((t) => t.kicker)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(tones.map((t) => t.resultLabel)).size).toBe(4);
    expect(new Set(tones.map((t) => t.buttonText)).size).toBe(4);
    expect(new Set(tones.map((t) => t.cardColor)).size).toBe(4);
    expect(new Set(tones.map((t) => t.badgeColor)).size).toBe(4);
  });

  it("副标题与档位同源", () => {
    expect(celebrationSummary(10, 10)).toContain("全对");
    expect(celebrationSummary(8, 10)).toContain("接近满分");
    expect(celebrationSummary(6, 10)).toContain("还差一点点");
    expect(celebrationSummary(3, 10)).toContain("复习队列");
    expect(celebrationSummary(0, 0)).toContain("没有可统计");
  });
});
