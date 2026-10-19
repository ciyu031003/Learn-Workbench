import { describe, it, expect } from "vitest";
import {
  addDaysToDateKey,
  computeDailyCompletion,
  computeStreak,
  dateKeyInZone,
  todayISOInZone,
} from "@learn-workbench/shared/domains";

/**
 * S5-1 双端口径快照（WEB 侧）。
 *
 * ⚠️ 本文件与 apps/mobile/src/lib/domains-parity.test.ts 使用**逐字相同**的 fixture 与
 * 期望常量；两份都绿 = Web / Mobile 从 shared 拿到的完成度、日期、streak 完全一致。
 * 改口径必须同时改 shared 的实现与本快照（快照即双端契约）。
 */

const NOW = "2026-10-19T10:00:00+08:00";

const COMPLETION_INPUT = {
  tasksTotal: 5,
  tasksDone: 4,
  habitsScheduled: 3,
  habitsDone: 2,
  workoutDone: true,
  nutritionKcal: 1800,
  nutritionTargetKcal: 2000,
};

/** 跨零点的打卡事件（含同日重复） */
const STREAK_EVENTS = [
  "2026-10-17T23:30:00+08:00", // 10-17 23:30
  "2026-10-18T00:10:00+08:00", // 10-18 00:10
  "2026-10-18T23:50:00+08:00", // 10-18 同日重复
  "2026-10-16T08:00:00+08:00", // 10-16
];

const SNAPSHOT = {
  completionProgress: 81,
  completionParts: { task: 0.8, habit: 2 / 3, workout: 1, nutrition: 0.9 },
  streak: 3,
  dayKeyBeforeMidnight: "2026-10-18",
  dayKeyAfterMidnight: "2026-10-19",
  todayInZone: "2026-10-19",
  previousDay: "2026-09-30",
  previousMonthDay: "2026-02-28",
};

describe("S5-1 双端口径快照（Web）", () => {
  it("与 Mobile 侧同一 fixture 产出逐字相同的快照", () => {
    const completion = computeDailyCompletion(COMPLETION_INPUT);
    const actual = {
      completionProgress: completion.progress,
      completionParts: completion.parts,
      streak: computeStreak(STREAK_EVENTS, { now: NOW }),
      dayKeyBeforeMidnight: dateKeyInZone("2026-10-18T15:59:59Z"),
      dayKeyAfterMidnight: dateKeyInZone("2026-10-18T16:00:00Z"),
      todayInZone: todayISOInZone("Asia/Shanghai", "2026-10-18T16:00:00Z"),
      previousDay: addDaysToDateKey("2026-10-01", -1),
      previousMonthDay: addDaysToDateKey("2026-03-01", -1),
    };
    expect(actual).toEqual(SNAPSHOT);
  });

  it("Web 端改口径会让快照失败（防回退）", () => {
    // 若有人把权重/取整/时区改回去，这里的 81/3 会立刻变化
    expect(computeDailyCompletion(COMPLETION_INPUT).progress).toBe(81);
    expect(computeStreak(STREAK_EVENTS, { now: NOW })).toBe(3);
  });
});
