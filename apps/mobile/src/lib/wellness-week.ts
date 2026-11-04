import { clamp01, formatPercent } from "@/lib/chart-math";

/**
 * 健康页「本周健康周报」视图模型（v2.2 数据面板接入 · 纯函数层）。
 *
 * 数据全部来自健康页**已有**的四路来源（不新增接口）：
 * - 饮水：/api/wellbeing/hydration（逐日复用同一个 GET ?date=，页面并行拉近 7 天）；
 * - 训练：/api/workouts?days=7（页面只取条数）；
 * - 睡眠：本机 AsyncStorage（lib/sleep.ts，只认昨晚，没有就「—」）；
 * - 热量：/api/nutrition/summary?days=7 的逐日行 + 页面算出的每日目标。
 *
 * 因此这里天然是「缺项即 —」的：任何一路失败都不编造 0，活动环画空、指标卡显示「—」。
 * 纯函数、零 RN import（看板踩坑 48），可直接单测。
 */

/** 无记录的统一占位（与健康页 NO_RECORD / 408 统计同字符） */
export const NO_WEEK_VALUE = "—";

/** 训练周目标（次）：与「本周 3 练」的常用口径一致，只用于活动环达成率 */
export const WEEK_WORKOUT_TARGET = 3;
/** 睡眠目标（小时）：只影响活动环的达成率，不改任何既有判定 */
export const SLEEP_TARGET_HOURS = 8;
/** 饮水目标兜底（ml）：服务端缺目标时与旧版同口径 */
export const HYDRATION_TARGET_FALLBACK_ML = 2000;
/** 热量目标兜底（kcal）：与健康页 `dietTarget ?? 2000` 同口径 */
export const KCAL_TARGET_FALLBACK = 2000;

export interface WeekKcalRow {
  date?: string;
  kcal: number;
  entryCount: number;
}

export interface WeekReportInput {
  /** 近 7 天逐日饮水总量（由旧到新，最后一天 = 今天）；null = 该天没取到 */
  waterByDay: readonly (number | null)[];
  waterTargetMl: number;
  /** 近 7 天训练次数；null = 接口失败（不是 0） */
  workoutCount: number | null;
  /** 本机昨晚睡眠小时数；null = 没有记录 / 过期 */
  sleepHours: number | null;
  /** /api/nutrition/summary 的逐日行 */
  kcalRows: readonly WeekKcalRow[];
  kcalTarget: number;
  /** summary 接口是否成功：false 时热量达天数显示「—」而不是假的 0 */
  kcalAvailable: boolean;
}

/** 活动环一项（饮水 / 训练 / 睡眠达成率） */
export interface WeekRing {
  key: string;
  label: string;
  /** 0..1 达成率（无数据时 0，图例显示「—」） */
  value: number;
  valueLabel: string;
}

/** 指标卡一格 */
export interface WeekTile {
  label: string;
  value: string;
  unit?: string;
  hint: string;
}

export interface WeekReport {
  rings: WeekRing[];
  water: WeekTile;
  workout: WeekTile;
  sleep: WeekTile;
  kcal: WeekTile;
  /** 本周饮水达标天数；null = 没有任何一天的饮水数据 */
  waterDays: number | null;
  workoutCount: number | null;
  /** 平均睡眠：本机只有昨晚一条，有值即等于该值 */
  avgSleepHours: number | null;
  /** 热量在目标内的天数；null = 接口失败，无法判断 */
  kcalInTargetDays: number | null;
  /** 四路数据全都没有（页面据此给一句「先记一条」的提示） */
  empty: boolean;
  /** 环下方的口径说明 */
  caption: string;
}

function positiveOr(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/** 达标率：value / target，夹 0..1（超额在环上画满） */
export function achievementRatio(value: number, target: number): number {
  const safeTarget = positiveOr(target, 1);
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  return clamp01(safeValue / safeTarget);
}

/**
 * 统计窗口内「达标天数」：只数有数据的天，null（没取到）不参与分母。
 * 没有任何一天有数据 → null（不是 0）。
 */
export function achievedDays(values: readonly (number | null)[], target: number): number | null {
  const safeTarget = positiveOr(target, 1);
  let known = 0;
  let achieved = 0;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    known += 1;
    if (value >= safeTarget) achieved += 1;
  }
  return known > 0 ? achieved : null;
}

/** 热量在目标内的天数：只算「有饮食记录且不超目标」的天 */
export function kcalInTargetDays(rows: readonly WeekKcalRow[], target: number): number | null {
  if (!Array.isArray(rows)) return null;
  const safeTarget = positiveOr(target, 1);
  let count = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const entries = finiteOrNull(Number(row.entryCount));
    if (entries === null || entries <= 0) continue;
    const kcal = finiteOrNull(Number(row.kcal));
    if (kcal === null || kcal <= 0) continue;
    if (kcal <= safeTarget) count += 1;
  }
  return count;
}

/** 活动环图例数值：有数据 → 百分比；无数据 → 「—」 */
function ringValueLabel(value: number | null): string {
  return value === null ? NO_WEEK_VALUE : formatPercent(value);
}

/** 组装周报（永不抛异常，缺项一律「—」） */
export function buildWeekReport(input: WeekReportInput): WeekReport {
  const target = positiveOr(input.waterTargetMl, HYDRATION_TARGET_FALLBACK_ML);
  const kcalTarget = positiveOr(input.kcalTarget, KCAL_TARGET_FALLBACK);
  const waters = Array.isArray(input.waterByDay) ? input.waterByDay : [];

  const todayWater = waters.length > 0 ? finiteOrNull(waters[waters.length - 1]) : null;
  const waterDays = achievedDays(waters, target);
  const workoutCount = finiteOrNull(input.workoutCount);
  const sleepHours = finiteOrNull(input.sleepHours);
  const kcalDays = input.kcalAvailable ? kcalInTargetDays(input.kcalRows, kcalTarget) : null;

  const waterRatio = todayWater === null ? null : achievementRatio(todayWater, target);
  const workoutRatio = workoutCount === null ? null : achievementRatio(workoutCount, WEEK_WORKOUT_TARGET);
  const sleepRatio = sleepHours === null ? null : achievementRatio(sleepHours, SLEEP_TARGET_HOURS);

  const rings: WeekRing[] = [
    { key: "water", label: "饮水", value: waterRatio ?? 0, valueLabel: ringValueLabel(waterRatio) },
    { key: "workout", label: "训练", value: workoutRatio ?? 0, valueLabel: ringValueLabel(workoutRatio) },
    { key: "sleep", label: "睡眠", value: sleepRatio ?? 0, valueLabel: ringValueLabel(sleepRatio) },
  ];

  const water: WeekTile = {
    label: "饮水达标",
    value: waterDays === null ? NO_WEEK_VALUE : String(waterDays),
    ...(waterDays === null ? {} : { unit: "天" }),
    hint: `目标 ${Math.round(target)} ml`,
  };
  const workout: WeekTile = {
    label: "训练次数",
    value: workoutCount === null ? NO_WEEK_VALUE : String(workoutCount),
    ...(workoutCount === null ? {} : { unit: "次" }),
    hint: "近 7 天",
  };
  const sleep: WeekTile = {
    label: "平均睡眠",
    value: sleepHours === null ? NO_WEEK_VALUE : sleepHours.toFixed(1),
    ...(sleepHours === null ? {} : { unit: "h" }),
    hint: "仅昨晚记录",
  };
  const kcal: WeekTile = {
    label: "热量达标",
    value: kcalDays === null ? NO_WEEK_VALUE : String(kcalDays),
    ...(kcalDays === null ? {} : { unit: "天" }),
    hint: `≤ ${Math.round(kcalTarget)} kcal`,
  };

  const empty = waterDays === null && workoutCount === null && sleepHours === null && kcalDays === null;

  return {
    rings,
    water,
    workout,
    sleep,
    kcal,
    waterDays,
    workoutCount,
    avgSleepHours: sleepHours,
    kcalInTargetDays: kcalDays,
    empty,
    caption: `近 7 天口径 · 饮水 ${Math.round(target)} ml / 训练 ${WEEK_WORKOUT_TARGET} 次 / 睡眠 ${SLEEP_TARGET_HOURS} h`,
  };
}
