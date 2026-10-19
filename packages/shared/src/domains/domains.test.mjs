/**
 * S5-1 口径单测（Node 内置 test runner；shared 包没有 vitest，故用 node --test 跑）。
 *
 * 运行：node --test packages/shared/src/domains/domains.test.mjs
 * 说明：本文件是 .mjs（不是 .ts），因此不进 shared 的 tsc program；直接 import 同目录 .ts，
 *      由 Node 内置的 TypeScript type-stripping 处理（Node >= 22.18 / 24）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { addDaysToDateKey, dateKeyInZone, isDateKey, todayISOInZone } from "./date.ts";
import { computeStreak } from "./streak.ts";
import { computeDailyCompletion, DAILY_COMPLETION_WEIGHTS } from "./completion.ts";

/* ============ 日期：Asia/Shanghai 跨零点 / 无 DST ============ */

test("dateKeyInZone: 东八区跨零点（00:00 前后分属不同日历日）", () => {
  // UTC 15:59:59 = 东八区 23:59:59 → 仍是 10-18
  assert.equal(dateKeyInZone("2026-10-18T15:59:59Z"), "2026-10-18");
  // UTC 16:00:00 = 东八区次日 00:00 → 10-19
  assert.equal(dateKeyInZone("2026-10-18T16:00:00Z"), "2026-10-19");
  // 同一瞬间在 UTC 与东八区的日期不同（这正是历史 bug 的来源）
  assert.equal(dateKeyInZone("2026-10-18T16:30:00Z", "UTC"), "2026-10-18");
  assert.equal(dateKeyInZone("2026-10-18T16:30:00Z", "Asia/Shanghai"), "2026-10-19");
});

test("todayISOInZone: 可注入 now，跨零点正确", () => {
  assert.equal(todayISOInZone("Asia/Shanghai", "2026-10-18T15:59:59Z"), "2026-10-18");
  assert.equal(todayISOInZone("Asia/Shanghai", "2026-10-18T16:00:00Z"), "2026-10-19");
  assert.equal(todayISOInZone("Asia/Shanghai", new Date("2026-01-01T00:00:00+08:00")), "2026-01-01");
});

test("中国无夏令时：美东 DST 切换日前后东八区偏移恒为 +08:00", () => {
  // 2026-03-08（美东进入 DST）与 2026-11-01（退出 DST）前后，东八区都是 16:00Z 跨零点
  for (const utc of ["2026-03-08T15:59:59Z", "2026-03-08T16:00:00Z", "2026-11-01T15:59:59Z", "2026-11-01T16:00:00Z"]) {
    const before = dateKeyInZone(utc);
    const after = dateKeyInZone(new Date(new Date(utc).getTime() + 1000));
    assert.ok(before === after || addDaysToDateKey(before, 1) === after, utc + " 东八区日期只可能前进一天");
  }
  assert.equal(dateKeyInZone("2026-03-08T16:00:00Z"), "2026-03-09");
  assert.equal(dateKeyInZone("2026-11-01T16:00:00Z"), "2026-11-02");
  // 同一 UTC 时刻，东八区的小时数始终 = UTC+8（用 Intl 直接核对，证明无本地 DST 平移）
  const hour = (tz) =>
    Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date("2026-03-08T04:00:00Z")));
  assert.equal(hour("Asia/Shanghai"), 12);
  assert.equal(hour("UTC"), 4);
});

test("dateKeyInZone: 已是日期键时原样返回（不被时区平移）", () => {
  assert.equal(dateKeyInZone("2026-10-18"), "2026-10-18");
  assert.equal(dateKeyInZone(" 2026-10-18 "), "2026-10-18");
  assert.equal(isDateKey("2026-10-18"), true);
  assert.equal(isDateKey("2026-1-8"), false);
  assert.equal(isDateKey(20261018), false);
});

test("dateKeyInZone: 非法输入抛 RangeError（不静默给错日期）", () => {
  assert.throws(() => dateKeyInZone("not-a-date"), RangeError);
  assert.throws(() => dateKeyInZone(new Date(Number.NaN)), RangeError);
  assert.throws(() => dateKeyInZone(new Date(), "Not/AZone"), RangeError);
});

test("addDaysToDateKey: 跨月 / 跨年 / 闰日", () => {
  assert.equal(addDaysToDateKey("2026-10-01", -1), "2026-09-30");
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToDateKey("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysToDateKey("2026-03-01", -1), "2026-02-28");
  assert.throws(() => addDaysToDateKey("2026/10/01", 1), RangeError);
});

/* ============ streak：断档 / 同日多事件 / 今日未打卡 / 跨时区 ============ */

test("computeStreak: 连续天数与 Web 原实现一致（今天没打卡不算断）", () => {
  const days = ["2026-10-17", "2026-10-18", "2026-10-19"];
  assert.equal(computeStreak(days, { now: "2026-10-19T10:00:00+08:00" }), 3);
  // 今天（10-20）还没打卡 → 从昨天起数，不打断
  assert.equal(computeStreak(days, { now: "2026-10-20T10:00:00+08:00" }), 3);
  // 断档：缺 10-18
  assert.equal(computeStreak(["2026-10-17", "2026-10-19"], { now: "2026-10-19T10:00:00+08:00" }), 1);
  // 空集合
  assert.equal(computeStreak([], { now: "2026-10-19T10:00:00+08:00" }), 0);
});

test("computeStreak: 同日多事件去重；未来日期不虚增", () => {
  const events = [
    "2026-10-19T08:00:00+08:00",
    "2026-10-19T09:30:00+08:00",
    "2026-10-18T23:59:00+08:00",
    "2026-10-17T07:00:00+08:00",
    "2026-10-25T07:00:00+08:00", // 未来，不在连续段里
  ];
  assert.equal(computeStreak(events, { now: "2026-10-19T10:00:00+08:00" }), 3);
});

test("computeStreak: 跨时区事件按业务时区归日（16:30Z = 东八区次日）", () => {
  // 2026-10-18T16:30Z = 东八区 10-19 00:30
  assert.equal(computeStreak(["2026-10-18T16:30:00Z"], { now: "2026-10-19T10:00:00+08:00" }), 1);
  // 同一事件在 UTC 口径属于 10-18
  assert.equal(computeStreak(["2026-10-18T16:30:00Z"], { tz: "UTC", now: "2026-10-18T20:00:00Z" }), 1);
});

test("computeStreak: 非法事件被忽略", () => {
  const events = [null, undefined, "", "bogus", Number.NaN, "2026-10-19", "2026-10-18"];
  assert.equal(computeStreak(events, { now: "2026-10-19T10:00:00+08:00" }), 2);
});

/* ============ completion：与 Web 原加权口径逐位一致 ============ */

test("computeDailyCompletion: 快照（Web 原公式逐位一致）", () => {
  const result = computeDailyCompletion({
    tasksTotal: 5,
    tasksDone: 4,
    habitsScheduled: 3,
    habitsDone: 2,
    workoutDone: true,
    nutritionKcal: 1800,
    nutritionTargetKcal: 2000,
  });
  // 40*0.8 + 30*(2/3) + 15*1 + 15*0.9 = 32 + 20 + 15 + 13.5 = 80.5 → 81
  assert.equal(result.progress, 81);
  assert.equal(result.parts.task, 0.8);
  assert.equal(result.parts.habit, 2 / 3);
  assert.equal(result.parts.workout, 1);
  assert.equal(result.parts.nutrition, 0.9);
  assert.deepEqual(DAILY_COMPLETION_WEIGHTS, { task: 40, habit: 30, workout: 15, nutrition: 15 });
});

test("computeDailyCompletion: 空日 = 0；全完成/超额 = 夹到 100", () => {
  assert.equal(
    computeDailyCompletion({ tasksTotal: 0, tasksDone: 0, habitsScheduled: 0, habitsDone: 0 }).progress,
    0
  );
  assert.equal(
    computeDailyCompletion({
      tasksTotal: 2,
      tasksDone: 2,
      habitsScheduled: 2,
      habitsDone: 2,
      workoutDone: 1,
      nutritionKcal: 5000,
      nutritionTargetKcal: 2000,
    }).progress,
    100
  );
});

test("computeDailyCompletion: 脏值不产生 NaN（目标 0 / 非法输入）", () => {
  const result = computeDailyCompletion({
    tasksTotal: Number.NaN,
    tasksDone: 3,
    habitsScheduled: -1,
    habitsDone: 1,
    workoutDone: null,
    nutritionKcal: Number.NaN,
    nutritionTargetKcal: 0,
  });
  assert.equal(result.progress, 0);
  assert.deepEqual(result.parts, { task: 0, habit: 0, workout: 0, nutrition: 0 });
});
