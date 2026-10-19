import { describe, expect, it } from "vitest";
import {
  DEFAULT_BATCH_SIZE,
  clampWindow,
  hasMore,
  nextWindowSize,
  visibleSlice,
  windowLabel,
} from "./windowed-list";

describe("clampWindow", () => {
  it("夹到 [0, total]", () => {
    expect(clampWindow(30, 100)).toBe(30);
    expect(clampWindow(120, 100)).toBe(100);
    expect(clampWindow(-5, 100)).toBe(0);
    expect(clampWindow(30, 0)).toBe(0);
    expect(clampWindow(30, -1)).toBe(0);
  });

  it("非法输入归零", () => {
    expect(clampWindow(Number.NaN, 10)).toBe(0);
    expect(clampWindow(5, Number.NaN)).toBe(0);
  });
});

describe("nextWindowSize", () => {
  it("每次递增一个 batch，且不超过 total", () => {
    expect(nextWindowSize(30, 100)).toBe(60);
    expect(nextWindowSize(90, 100)).toBe(100);
    expect(nextWindowSize(100, 100)).toBe(100);
  });

  it("自定义 batch 与非法 batch 兜底", () => {
    expect(nextWindowSize(0, 100, 20)).toBe(20);
    expect(nextWindowSize(0, 100, 0)).toBe(DEFAULT_BATCH_SIZE);
    expect(nextWindowSize(0, 100, Number.NaN)).toBe(DEFAULT_BATCH_SIZE);
  });

  it("total 比当前窗口小时直接收敛到 total（数据变短场景）", () => {
    expect(nextWindowSize(200, 35)).toBe(35);
  });
});

describe("hasMore", () => {
  it("边界", () => {
    expect(hasMore(0, 10)).toBe(true);
    expect(hasMore(9, 10)).toBe(true);
    expect(hasMore(10, 10)).toBe(false);
    expect(hasMore(30, 0)).toBe(false);
    expect(hasMore(30, -1)).toBe(false);
  });
});

describe("visibleSlice", () => {
  it("返回窗口前缀且不改原数组", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(visibleSlice(items, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(items).toHaveLength(50);
  });

  it("空数组与越界窗口安全", () => {
    expect(visibleSlice([], 30)).toEqual([]);
    expect(visibleSlice([1, 2, 3], 999)).toEqual([1, 2, 3]);
    expect(visibleSlice([1, 2, 3], -1)).toEqual([]);
  });
});

describe("windowLabel", () => {
  it("输出已显示/总数", () => {
    expect(windowLabel(30, 155, "道")).toBe("已显示 30 / 155 道");
    expect(windowLabel(999, 155, "道")).toBe("已显示 155 / 155 道");
    expect(windowLabel(0, 0)).toBe("已显示 0 / 0 条");
  });
});
