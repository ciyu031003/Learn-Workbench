import { describe, expect, it } from "vitest";
import {
  TRAINING_LOAD_MIN_HEIGHT,
  toDateKey,
  trainingLoadSeries,
  type WorkoutItem,
} from "@learn-workbench/shared";

/**
 * v1.44.2 训练负荷口径单测。
 *
 * 真机反馈：「添加了训练记录以后，统计的训练负荷数据是空的，柱状图没有显示」。
 * 根因是负荷只按「组 × 次 × kg」算，而**自重动作的 weightKg 是 null** →
 * 容量恒为 0 → 柱高一律取到最小 4%（约 3px）、总容量显示 0。
 * 这里锁死"只要记录了训练就一定有可见的柱"以及口径退档顺序。
 */

const END = new Date(2026, 9, 12); // 2026-10-12（本地）
const dayKey = (daysAgo: number) => toDateKey(new Date(2026, 9, 12 - daysAgo));

function item(partial: Partial<WorkoutItem>): WorkoutItem {
  return {
    exerciseKey: null,
    exerciseLabel: "动作",
    sets: 1,
    reps: 1,
    weightKg: null,
    durationSeconds: 0,
    sortOrder: 0,
    ...partial,
  };
}

/** 只带训练负荷需要的三个字段（函数签名就是 Pick） */
function workout(exercisedOn: string, items: WorkoutItem[], durationSeconds = 0) {
  return { exercisedOn, items, durationSeconds };
}

const bodyweight = workout(dayKey(0), [item({ exerciseLabel: "俯卧撑", sets: 4, reps: 12, weightKg: null })]);
const weighted = workout(dayKey(1), [item({ exerciseLabel: "深蹲", sets: 5, reps: 5, weightKg: 60 })]);

describe("trainingLoadSeries", () => {
  it("没有任何训练时全为 0，且不会出现 NaN", () => {
    const s = trainingLoadSeries([], 7, END);
    expect(s.days).toHaveLength(7);
    expect(s.total.sessions).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(1);
    for (const d of s.days) {
      expect(d.height).toBe(0);
      expect(Number.isFinite(d.value)).toBe(true);
    }
  });

  it("回归：只有自重训练（weightKg = null）也必须有可见的柱子", () => {
    const s = trainingLoadSeries([bodyweight], 7, END);
    const today = s.days[s.days.length - 1];
    expect(today.sessions).toBe(1);
    expect(today.volumeKg).toBe(0); // 自重确实算不出容量
    expect(today.height).toBeGreaterThanOrEqual(TRAINING_LOAD_MIN_HEIGHT); // 但柱子要看得见
  });

  it("回归：自重训练时口径自动退到次数，而不是死守容量", () => {
    const s = trainingLoadSeries([bodyweight], 7, END);
    expect(s.metric).toBe("reps");
    expect(s.total.reps).toBe(4 * 12);
  });

  it("有重量时优先用容量口径", () => {
    const s = trainingLoadSeries([weighted], 7, END);
    expect(s.metric).toBe("volume");
    expect(s.total.volumeKg).toBe(5 * 5 * 60);
  });

  it("一周内口径统一：同一天既有自重又有负重时仍用容量", () => {
    const s = trainingLoadSeries([bodyweight, weighted], 7, END);
    expect(s.metric).toBe("volume");
  });

  it("完全没有 sets/reps 时退到「训练次数」，柱子仍可见", () => {
    const bare = workout(dayKey(2), [item({ sets: 0, reps: 0, weightKg: null })]);
    const s = trainingLoadSeries([bare], 7, END);
    expect(s.metric).toBe("sessions");
    const d = s.days.find((x) => x.key === dayKey(2))!;
    expect(d.value).toBe(1);
    expect(d.height).toBeGreaterThanOrEqual(TRAINING_LOAD_MIN_HEIGHT);
  });

  it("柱高按当天值占最大值的比例，最高那天为 100%", () => {
    const light = workout(dayKey(0), [item({ sets: 1, reps: 10, weightKg: 10 })]);
    const heavy = workout(dayKey(1), [item({ sets: 1, reps: 10, weightKg: 40 })]);
    const s = trainingLoadSeries([light, heavy], 7, END);
    const maxDay = s.days.reduce((a, b) => (a.value >= b.value ? a : b));
    expect(maxDay.height).toBe(100);
    const small = s.days.find((x) => x.value > 0 && x !== maxDay)!;
    expect(small.height).toBeGreaterThanOrEqual(TRAINING_LOAD_MIN_HEIGHT);
    expect(small.height).toBeLessThan(100);
  });

  it("只统计窗口内的训练（窗口外的不计入）", () => {
    const old = workout(dayKey(30), [item({ sets: 3, reps: 10, weightKg: 50 })]);
    const s = trainingLoadSeries([old], 7, END);
    expect(s.total.sessions).toBe(0);
    expect(s.total.volumeKg).toBe(0);
  });

  it("按本地日匹配，日期带时间后缀也能对上", () => {
    const withTime = workout(dayKey(0) + "T00:00:00.000Z", [item({ sets: 3, reps: 10, weightKg: 20 })]);
    const s = trainingLoadSeries([withTime], 7, END);
    expect(s.total.sessions).toBe(1);
  });

  it("区间合计算上了时长，供健康趋势复用", () => {
    const s = trainingLoadSeries([workout(dayKey(0), [], 1800), workout(dayKey(1), [], 900)], 7, END);
    expect(s.total.durationSeconds).toBe(2700);
    expect(s.total.sessions).toBe(2);
  });

  it("柱子数量与请求天数一致（7 天 / 30 天）", () => {
    expect(trainingLoadSeries([], 7, END).days).toHaveLength(7);
    expect(trainingLoadSeries([], 30, END).days).toHaveLength(30);
  });
});
