import { describe, expect, it } from "vitest";
import {
  HYDRATION_TARGET_FALLBACK_ML,
  KCAL_TARGET_FALLBACK,
  NO_WEEK_VALUE,
  SLEEP_TARGET_HOURS,
  WEEK_WORKOUT_TARGET,
  achievedDays,
  achievementRatio,
  buildWeekReport,
  kcalInTargetDays,
} from "./wellness-week";

/**
 * 健康页「本周健康周报」视图模型单测（v2.2）。
 *
 * 钉住的口径：
 * - 缺项一律「—」（不把「没取到」画成 0）；
 * - 达标按 ≥ 目标算（正好等于目标算达标）；
 * - 达成率夹 0..1（超额画满环，图例仍报 100%）；
 * - 目标缺失/为 0 时回落默认值，任何输入都不产生 NaN。
 */

describe("achievementRatio", () => {
  it("夹 0..1，超额算满", () => {
    expect(achievementRatio(1500, 2000)).toBe(0.75);
    expect(achievementRatio(2600, 2000)).toBe(1);
    expect(achievementRatio(0, 2000)).toBe(0);
    expect(achievementRatio(Number.NaN, 2000)).toBe(0);
  });

  it("目标为 0 / 负数 / 脏值时按 1 处理，不产生 Infinity/NaN", () => {
    expect(achievementRatio(10, 0)).toBe(1);
    expect(achievementRatio(10, -5)).toBe(1);
    expect(Number.isFinite(achievementRatio(10, Number.NaN))).toBe(true);
  });
});

describe("achievedDays", () => {
  it("只数有数据的天，正好等于目标算达标", () => {
    expect(achievedDays([1800, 2000, 2500, null, 900, 2100, 2600], 2000)).toBe(4);
  });

  it("一天都没有数据 → null（不是 0）", () => {
    expect(achievedDays([null, null, null], 2000)).toBeNull();
    expect(achievedDays([], 2000)).toBeNull();
  });
});

describe("kcalInTargetDays", () => {
  it("只算有饮食记录且不超目标的天", () => {
    const rows = [
      { kcal: 1800, entryCount: 2 },
      { kcal: 2000, entryCount: 1 },
      { kcal: 2600, entryCount: 3 },
      { kcal: 0, entryCount: 0 },
    ];
    expect(kcalInTargetDays(rows, 2000)).toBe(2);
  });

  it("脏行与脏值跳过", () => {
    const rows = [
      { kcal: Number.NaN, entryCount: 1 },
      { kcal: 1200, entryCount: 0 },
      { kcal: 1200, entryCount: Number.NaN },
      { kcal: 1200, entryCount: 2 },
    ];
    expect(kcalInTargetDays(rows, 2000)).toBe(1);
  });
});

describe("buildWeekReport", () => {
  const full = () =>
    buildWeekReport({
      waterByDay: [1800, 2500, null, 2000, 900, 2100, 2600],
      waterTargetMl: 2000,
      workoutCount: 2,
      sleepHours: 7.5,
      kcalRows: [
        { kcal: 1800, entryCount: 2 },
        { kcal: 2000, entryCount: 1 },
        { kcal: 2600, entryCount: 3 },
      ],
      kcalTarget: 2000,
      kcalAvailable: true,
    });

  it("四格指标按周窗口取数", () => {
    const report = full();
    expect(report.water).toEqual({ label: "饮水达标", value: "4", unit: "天", hint: "目标 2000 ml" });
    expect(report.workout).toEqual({ label: "训练次数", value: "2", unit: "次", hint: "近 7 天" });
    expect(report.sleep).toEqual({ label: "平均睡眠", value: "7.5", unit: "h", hint: "仅昨晚记录" });
    expect(report.kcal).toEqual({ label: "热量达标", value: "2", unit: "天", hint: "≤ 2000 kcal" });
    expect(report.waterDays).toBe(4);
    expect(report.kcalInTargetDays).toBe(2);
    expect(report.empty).toBe(false);
  });

  it("活动环三项达成率（饮水看今天，超额画满）", () => {
    const report = full();
    expect(report.rings.map((ring) => ring.key)).toEqual(["water", "workout", "sleep"]);
    expect(report.rings[0].value).toBe(1);
    expect(report.rings[0].valueLabel).toBe("100%");
    expect(report.rings[1].value).toBeCloseTo(2 / WEEK_WORKOUT_TARGET, 5);
    expect(report.rings[1].valueLabel).toBe("67%");
    expect(report.rings[2].value).toBeCloseTo(7.5 / SLEEP_TARGET_HOURS, 5);
    expect(report.rings[2].valueLabel).toBe("94%");
  });

  it("四路全缺：全部「—」，环画空，empty=true", () => {
    const report = buildWeekReport({
      waterByDay: [null, null, null, null, null, null, null],
      waterTargetMl: 0,
      workoutCount: null,
      sleepHours: null,
      kcalRows: [],
      kcalTarget: 0,
      kcalAvailable: false,
    });
    expect(report.rings.map((ring) => ring.valueLabel)).toEqual([
      NO_WEEK_VALUE,
      NO_WEEK_VALUE,
      NO_WEEK_VALUE,
    ]);
    expect(report.rings.every((ring) => ring.value === 0)).toBe(true);
    for (const tile of [report.water, report.workout, report.sleep, report.kcal]) {
      expect(tile.value).toBe(NO_WEEK_VALUE);
      expect(tile.unit).toBeUndefined();
    }
    expect(report.empty).toBe(true);
    // 目标兜底：饮水 2000 ml / 热量 2000 kcal（不出现 "≤ 0 kcal" 之类的脏文案）
    expect(report.water.hint).toBe(`目标 ${HYDRATION_TARGET_FALLBACK_ML} ml`);
    expect(report.kcal.hint).toBe(`≤ ${KCAL_TARGET_FALLBACK} kcal`);
  });

  it("今天饮水缺失但前几天有数据：周天数照算，环显示「—」", () => {
    const report = buildWeekReport({
      waterByDay: [2500, 2500, 2500, 2500, 2500, 2500, null],
      waterTargetMl: 2000,
      workoutCount: 0,
      sleepHours: null,
      kcalRows: [],
      kcalTarget: 2000,
      kcalAvailable: true,
    });
    expect(report.waterDays).toBe(6);
    expect(report.rings[0].value).toBe(0);
    expect(report.rings[0].valueLabel).toBe(NO_WEEK_VALUE);
    expect(report.workout.value).toBe("0");
    expect(report.workout.unit).toBe("次");
    expect(report.kcal.value).toBe("0");
    expect(report.empty).toBe(false);
  });

  it("热量接口失败时显示「—」而不是 0", () => {
    const report = buildWeekReport({
      waterByDay: [2000],
      waterTargetMl: 2000,
      workoutCount: 1,
      sleepHours: 8,
      kcalRows: [{ kcal: 1800, entryCount: 2 }],
      kcalTarget: 2000,
      kcalAvailable: false,
    });
    expect(report.kcal.value).toBe(NO_WEEK_VALUE);
    expect(report.kcalInTargetDays).toBeNull();
  });

  it("caption 带上口径与目标，方便用户理解环的基准", () => {
    expect(full().caption).toContain("饮水 2000 ml");
    expect(full().caption).toContain(`训练 ${WEEK_WORKOUT_TARGET} 次`);
    expect(full().caption).toContain(`睡眠 ${SLEEP_TARGET_HOURS} h`);
  });
});
