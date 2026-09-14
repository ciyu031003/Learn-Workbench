import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { computeHabitStats, isHabitDone, isScheduled, toDateKey, fromDateKey } from "@learn-workbench/shared";
import type { Habit } from "@learn-workbench/shared";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function habit(over: Partial<Habit> = {}): Pick<Habit, "id" | "isBoolean" | "targetValue" | "schedule"> {
  return { id: 1, isBoolean: true, targetValue: null, schedule: EVERY_DAY, ...over };
}

/** 相对今天偏移 n 天的日期键 */
function daysAgo(n: number, today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - n);
  return toDateKey(d);
}

const TODAY = new Date(2026, 8, 14); // 2026-09-14 周一

beforeEach(() => vi.resetAllMocks());

describe("date helpers", () => {
  it("round-trips a date key", () => {
    expect(toDateKey(fromDateKey("2026-09-14"))).toBe("2026-09-14");
  });
});

describe("isScheduled", () => {
  it("treats an empty schedule as every day", () => {
    expect(isScheduled([], TODAY)).toBe(true);
  });
  it("matches the weekday", () => {
    // 2026-09-14 是周一 → getDay()=1
    expect(isScheduled([1], TODAY)).toBe(true);
    expect(isScheduled([0], TODAY)).toBe(false);
  });
});

describe("isHabitDone", () => {
  it("boolean habits need value >= 1", () => {
    expect(isHabitDone(habit(), 1)).toBe(true);
    expect(isHabitDone(habit(), 0)).toBe(false);
  });
  it("quantitative habits need value >= target", () => {
    const h = habit({ isBoolean: false, targetValue: 8 });
    expect(isHabitDone(h, 8)).toBe(true);
    expect(isHabitDone(h, 7)).toBe(false);
  });
  it("quantitative without target falls back to >= 1", () => {
    expect(isHabitDone(habit({ isBoolean: false, targetValue: null }), 1)).toBe(true);
  });
});

describe("computeHabitStats", () => {
  it("counts an unbroken streak ending today", () => {
    const logs = [0, 1, 2].map((n) => ({ habitId: 1, logDate: daysAgo(n, TODAY), value: 1 }));
    const s = computeHabitStats(habit(), logs, TODAY);
    expect(s.currentStreak).toBe(3);
    expect(s.doneToday).toBe(true);
    expect(s.longestStreak).toBe(3);
  });

  it("does not break the streak when today is not done yet", () => {
    const logs = [1, 2, 3].map((n) => ({ habitId: 1, logDate: daysAgo(n, TODAY), value: 1 }));
    const s = computeHabitStats(habit(), logs, TODAY);
    expect(s.doneToday).toBe(false);
    expect(s.currentStreak).toBe(3);
  });

  it("breaks the streak on a missed scheduled day", () => {
    const logs = [0, 2, 3].map((n) => ({ habitId: 1, logDate: daysAgo(n, TODAY), value: 1 }));
    const s = computeHabitStats(habit(), logs, TODAY);
    // 昨天(1)缺失 → 连续段只有今天
    expect(s.currentStreak).toBe(1);
  });

  it("skips non-scheduled days without breaking the streak", () => {
    // 只在周一(1)与周三(3)排期；今天周一。上次周三 = daysAgo 5
    const h = habit({ schedule: [1, 3] });
    const logs = [
      { habitId: 1, logDate: daysAgo(0, TODAY), value: 1 },  // 周一
      { habitId: 1, logDate: daysAgo(5, TODAY), value: 1 },  // 上周三
      { habitId: 1, logDate: daysAgo(7, TODAY), value: 1 },  // 上周一
    ];
    const s = computeHabitStats(h, logs, TODAY);
    expect(s.currentStreak).toBe(3);
  });

  it("keeps the longest streak independent of the current one", () => {
    const logs = [
      { habitId: 1, logDate: daysAgo(0, TODAY), value: 1 },
      { habitId: 1, logDate: daysAgo(10, TODAY), value: 1 },
      { habitId: 1, logDate: daysAgo(11, TODAY), value: 1 },
      { habitId: 1, logDate: daysAgo(12, TODAY), value: 1 },
      { habitId: 1, logDate: daysAgo(13, TODAY), value: 1 },
    ];
    const s = computeHabitStats(habit(), logs, TODAY);
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(4);
  });

  it("ignores logs belonging to other habits", () => {
    const logs = [{ habitId: 99, logDate: daysAgo(0, TODAY), value: 1 }];
    const s = computeHabitStats(habit(), logs, TODAY);
    expect(s.currentStreak).toBe(0);
    expect(s.doneToday).toBe(false);
  });

  it("computes weekly and monthly completion rates on scheduled days", () => {
    // 过去 7 天中完成 7 天（含今天）
    const logs = [0, 1, 2, 3, 4, 5, 6].map((n) => ({ habitId: 1, logDate: daysAgo(n, TODAY), value: 1 }));
    const s = computeHabitStats(habit(), logs, TODAY);
    expect(s.weekRate).toBe(100);
    expect(s.monthRate).toBe(23); // 7/30 ≈ 23%
  });

  it("handles quantitative completion against target", () => {
    const h = habit({ isBoolean: false, targetValue: 8 });
    const logs = [
      { habitId: 1, logDate: daysAgo(0, TODAY), value: 8 },
      { habitId: 1, logDate: daysAgo(1, TODAY), value: 5 }, // 未达标 → 中断
    ];
    const s = computeHabitStats(h, logs, TODAY);
    expect(s.doneToday).toBe(true);
    expect(s.currentStreak).toBe(1);
  });

  it("returns zeroes when there are no logs", () => {
    const s = computeHabitStats(habit(), [], TODAY);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.weekRate).toBe(0);
    expect(s.doneToday).toBe(false);
  });
});