import { describe, it, expect } from "vitest";
import {
  buildCompletion,
  buildWeekLogDays,
  completionRatio,
  countRecordedDays,
} from "./growth-model";

/**
 * 成长概览层纯逻辑（2026-11 重构）：
 *  - 缺项不能当 0（没记录 ≠ 没完成）；
 *  - 超额完成在环上画满（ratio 夹 1），但达标计数照常；
 *  - 周状态只认「真有一条记录」的天，接口失败那路不参与判定。
 */
describe("completionRatio", () => {
  it("缺任一侧数据返回 null（不把没记录当 0）", () => {
    expect(completionRatio(null, 2000)).toBeNull();
    expect(completionRatio(500, null)).toBeNull();
    expect(completionRatio(null, null)).toBeNull();
  });

  it("目标非正 / 非数字也返回 null", () => {
    expect(completionRatio(500, 0)).toBeNull();
    expect(completionRatio(Number.NaN, 2000)).toBeNull();
    expect(completionRatio(500, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("正常比值夹在 0..1", () => {
    expect(completionRatio(1000, 2000)).toBe(0.5);
    expect(completionRatio(3000, 2000)).toBe(1);
    expect(completionRatio(-5, 2000)).toBe(0);
  });
});

describe("buildCompletion", () => {
  it("只用有数据的项求平均", () => {
    const result = buildCompletion({
      habitsDone: 2,
      habitsScheduled: 4,
      exerciseMinutes: 30,
      waterMl: 1000,
      waterTargetMl: 2000,
      kcal: null,
      kcalTargetKcal: 2000,
    });
    // (0.5 + 1 + 0.5) / 3
    expect(result.ratio).toBeCloseTo(2 / 3);
    expect(result.percent).toBe(67);
    expect(result.metrics).toHaveLength(4);
    expect(result.metrics.find((m) => m.key === "diet")?.ratio).toBeNull();
  });

  it("全无数据时 ratio / percent 为 null，达标数为 0", () => {
    const result = buildCompletion({
      habitsDone: null,
      habitsScheduled: null,
      exerciseMinutes: null,
      waterMl: null,
      waterTargetMl: null,
      kcal: null,
      kcalTargetKcal: null,
    });
    expect(result.ratio).toBeNull();
    expect(result.percent).toBeNull();
    expect(result.achieved).toBe(0);
  });

  it("达标计数只数 ratio ≥ 1 的项", () => {
    const result = buildCompletion({
      habitsDone: 4,
      habitsScheduled: 4,
      exerciseMinutes: 45,
      waterMl: 500,
      waterTargetMl: 2000,
      kcal: 2100,
      kcalTargetKcal: 2000,
    });
    // 习惯 1、运动 1（夹到 1）、饮水 0.25、饮食 1（夹到 1）
    expect(result.achieved).toBe(3);
    expect(result.percent).toBe(81);
  });
});

describe("buildWeekLogDays", () => {
  const todayKey = "2026-11-22";

  it("按 todayKey 生成 7 个本地日期键并标记今天", () => {
    const days = buildWeekLogDays({
      todayKey,
      waterByDay: [0, 0, 0, 0, 0, 0, 0],
      kcalRows: [],
      kcalAvailable: true,
    });
    expect(days).toHaveLength(7);
    expect(days[6].key).toBe(todayKey);
    expect(days[6].isToday).toBe(true);
    expect(days.slice(0, 6).every((day) => !day.isToday)).toBe(true);
    // 2026-11-22 是周日，标签为「日」
    expect(days[6].label).toBe("日");
  });

  it("饮水或饮食任一有记录即算「有记录」", () => {
    const days = buildWeekLogDays({
      todayKey,
      waterByDay: [1500, 0, null, 0, 0, 0, 2000],
      kcalRows: [
        { date: "2026-11-21", entryCount: 2 },
        { date: "2026-11-20", entryCount: 0 },
      ],
      kcalAvailable: true,
    });
    const byKey = new Map(days.map((day) => [day.key, day]));
    expect(byKey.get("2026-11-16")?.recorded).toBe(true); // 饮水
    expect(byKey.get("2026-11-17")?.recorded).toBe(false); // 饮水 0、无饮食
    expect(byKey.get("2026-11-18")?.recorded).toBe(false); // 饮水没取到、无饮食
    expect(byKey.get("2026-11-21")?.recorded).toBe(true); // 饮食
    expect(byKey.get(todayKey)?.recorded).toBe(true); // 今天饮水 2000
  });

  it("饮食接口失败时不参与判定（不把空行当无记录）", () => {
    const days = buildWeekLogDays({
      todayKey,
      waterByDay: [0, 0, 0, 0, 0, 0, 0],
      kcalRows: [{ date: "2026-11-21", entryCount: 2 }],
      kcalAvailable: false,
    });
    expect(days.every((day) => !day.recorded)).toBe(true);
  });

  it("countRecordedDays 数出有记录的天", () => {
    const days = buildWeekLogDays({
      todayKey,
      waterByDay: [1500, 0, 0, 800, 0, 0, 2000],
      kcalRows: [],
      kcalAvailable: true,
    });
    expect(countRecordedDays(days)).toBe(3);
    expect(countRecordedDays([])).toBe(0);
  });
});
