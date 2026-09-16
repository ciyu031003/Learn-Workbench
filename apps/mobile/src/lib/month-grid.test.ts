import { describe, expect, it } from "vitest";
import { daysInMonth, monthGrid, monthRange, shiftMonth } from "./month-grid";

/**
 * 月历纯逻辑（从 learn.tsx 内联实现迁出后补的回归防线）：
 * 前置补空 / 跨月天数 / 闰年 / 尾部补齐 / 月查询窗口边界。
 */
describe("monthGrid", () => {
  it("前置补空 = 当月 1 号是周几（2026-09-01 是周二 → 补 2 个空）", () => {
    const cells = monthGrid(2026, 8); // 9 月
    expect(new Date(2026, 8, 1).getDay()).toBe(2);
    expect(cells.slice(0, 2)).toEqual([null, null]);
    expect(cells[2]).toBeInstanceOf(Date);
    expect((cells[2] as Date).getDate()).toBe(1);
  });

  it("1 号是周日时不补空（2026-11-01 是周日）", () => {
    const cells = monthGrid(2026, 10);
    expect(new Date(2026, 10, 1).getDay()).toBe(0);
    expect((cells[0] as Date).getDate()).toBe(1);
  });

  it("网格长度始终是 7 的倍数，且覆盖当月全部日期", () => {
    for (let m = 0; m < 12; m += 1) {
      const cells = monthGrid(2026, m);
      expect(cells.length % 7).toBe(0);
      const days = cells.filter((c): c is Date => c !== null);
      expect(days).toHaveLength(daysInMonth(2026, m));
      expect(days[0].getDate()).toBe(1);
      expect(days[days.length - 1].getDate()).toBe(daysInMonth(2026, m));
    }
  });

  it("闰年 2 月 = 29 天，平年 = 28 天", () => {
    expect(daysInMonth(2024, 1)).toBe(29); // 闰年
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(monthGrid(2024, 1).filter(Boolean)).toHaveLength(29);
  });

  it("格子日期是本地 00:00（避免跨时区偏一天）", () => {
    const cells = monthGrid(2026, 8);
    const first = cells.find((c): c is Date => c !== null)!;
    expect(first.getHours()).toBe(0);
    expect(first.getMinutes()).toBe(0);
  });
});

describe("shiftMonth", () => {
  it("跨年向前/向后都正确", () => {
    expect(shiftMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
    expect(shiftMonth({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
    expect(shiftMonth({ y: 2026, m: 5 }, 0)).toEqual({ y: 2026, m: 5 });
  });
});

describe("monthRange", () => {
  it("days = 该月天数，end = 该月最后一天（不是今天，避免带出上个月数据）", () => {
    expect(monthRange(2026, 8)).toEqual({ days: 30, end: "2026-09-30" });
    expect(monthRange(2026, 1)).toEqual({ days: 28, end: "2026-02-28" });
    expect(monthRange(2024, 1)).toEqual({ days: 29, end: "2024-02-29" });
  });

  it("days 不超过后端 summary 的上限 31", () => {
    for (let m = 0; m < 12; m += 1) expect(monthRange(2026, m).days).toBeLessThanOrEqual(31);
  });
});
