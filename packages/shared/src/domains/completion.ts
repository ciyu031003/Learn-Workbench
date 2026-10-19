/**
 * 今日完成度加权口径（S5-1）：唯一实现。
 *
 * 抽自 Web `apps/web/lib/daily-os.ts` 原有 231-256 行的口径（保持完全一致）：
 *   完成度 = 学习 40% + 习惯 30% + 运动 15% + 饮食 15%
 *   - 学习：今日任务 done / total（无任务记 0）
 *   - 习惯：今日排期完成 done / scheduled（无排期记 0）
 *   - 运动：今日有训练则满分
 *   - 饮食：min(1, 摄入 kcal / 目标 kcal)（目标至少按 1 算，防除零）
 *   最后 Math.round 并夹到 0–100。
 *
 * 双端必须共用本函数；任一端自己再写一遍加权即视为回归。
 * 纯函数、无 I/O。
 */

/** 各域权重（合计 100） */
export const DAILY_COMPLETION_WEIGHTS = {
  task: 40,
  habit: 30,
  workout: 15,
  nutrition: 15,
} as const;

export interface DailyCompletionInput {
  tasksTotal: number;
  tasksDone: number;
  habitsScheduled: number;
  habitsDone: number;
  /** 今日是否有运动（Web 传 workoutRows.length > 0；也可传次数） */
  workoutDone?: boolean | number | null;
  nutritionKcal?: number | null;
  nutritionTargetKcal?: number | null;
}

/** 各域完成比例（0–1），便于 UI 展示四域分解 */
export interface DailyCompletionParts {
  task: number;
  habit: number;
  workout: number;
  nutrition: number;
}

export interface DailyCompletion {
  /** 0–100 整数 */
  progress: number;
  parts: DailyCompletionParts;
}

function finiteOr(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ratio(done: unknown, total: unknown): number {
  const d = finiteOr(done);
  const t = finiteOr(total);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(1, d / t));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** 今日完成度（0–100）+ 四域比例 */
export function computeDailyCompletion(input: DailyCompletionInput): DailyCompletion {
  const task = ratio(input?.tasksDone, input?.tasksTotal);
  const habit = ratio(input?.habitsDone, input?.habitsScheduled);

  const workoutRaw = input?.workoutDone;
  const workout =
    workoutRaw === true || (typeof workoutRaw === "number" && Number.isFinite(workoutRaw) && workoutRaw > 0) ? 1 : 0;

  const kcal = Math.max(0, finiteOr(input?.nutritionKcal));
  const target = Math.max(1, finiteOr(input?.nutritionTargetKcal));
  const nutrition = clamp01(kcal / target);

  const raw =
    task * DAILY_COMPLETION_WEIGHTS.task +
    habit * DAILY_COMPLETION_WEIGHTS.habit +
    workout * DAILY_COMPLETION_WEIGHTS.workout +
    nutrition * DAILY_COMPLETION_WEIGHTS.nutrition;

  return {
    progress: Math.max(0, Math.min(100, Math.round(raw))),
    parts: { task, habit, workout, nutrition },
  };
}
