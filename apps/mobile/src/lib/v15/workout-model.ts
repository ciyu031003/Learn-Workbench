import type { Workout } from "@learn-workbench/shared/schemas";
import { workoutVolume } from "@learn-workbench/shared/pure";
import { WEEK_TILE_LABELS, weekKeysOf } from "@/lib/nutrition-views";
import { lastNDays } from "@/lib/v15/dates";

export interface WorkoutWeek {
  keys: string[];
  minutes: number;
  sessions: number;
  sets: number;
  reps: number;
  volumeKg: number;
  maxDayMinutes: number;
  days: { key: string; label: string; minutes: number; active: boolean }[];
}

function dayKey(workout: Workout): string {
  return typeof workout.exercisedOn === "string" ? workout.exercisedOn.slice(0, 10) : "";
}

/** 自然周（周一~周日）统计；没有 kcal 字段，绝不显示热量 */
export function buildWorkoutWeek(workouts: Workout[], todayKey: string): WorkoutWeek {
  const keys = weekKeysOf(todayKey);
  const inWeek = workouts.filter((workout) => keys.includes(dayKey(workout)));
  const totals = workoutVolume(inWeek.flatMap((workout) => workout.items));
  const days = keys.map((key, index) => {
    const minutes = inWeek
      .filter((workout) => dayKey(workout) === key)
      .reduce((sum, workout) => sum + Math.max(0, Math.round(Number(workout.durationSeconds) / 60) || 0), 0);
    return { key, label: WEEK_TILE_LABELS[index] ?? "", minutes, active: key === todayKey };
  });
  return {
    keys,
    minutes: days.reduce((sum, day) => sum + day.minutes, 0),
    sessions: inWeek.length,
    sets: totals.sets,
    reps: totals.reps,
    volumeKg: totals.volumeKg,
    maxDayMinutes: Math.max(1, ...days.map((day) => day.minutes)),
    days,
  };
}

export function isoWeekNumber(dateKey: string): number {
  const d = new Date(dateKey + "T00:00:00");
  if (Number.isNaN(d.getTime())) return 0;
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function weekGoalPct(minutes: number, goalMinutes = 150): number {
  if (!(goalMinutes > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((minutes / goalMinutes) * 100)));
}

export interface ExerciseShare {
  label: string;
  sets: number;
  reps: number;
  pct: number;
}

/** 近 7 天动作构成（按组数占比）；不足 4 项时补「其他」 */
export function buildExerciseComposition(workouts: Workout[], todayKey: string, limit = 4): ExerciseShare[] {
  const keys = lastNDays(todayKey, 7);
  const map = new Map<string, { sets: number; reps: number }>();
  for (const workout of workouts) {
    if (!keys.includes(dayKey(workout))) continue;
    for (const item of workout.items) {
      const label = (item.exerciseLabel || "未命名动作").trim();
      const prev = map.get(label) ?? { sets: 0, reps: 0 };
      map.set(label, {
        sets: prev.sets + Math.max(0, Number(item.sets) || 0),
        reps: prev.reps + Math.max(0, Number(item.reps) || 0),
      });
    }
  }
  const rows = [...map.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => b.sets - a.sets || b.reps - a.reps);
  if (rows.length === 0) return [];
  const totalSets = rows.reduce((sum, row) => sum + row.sets, 0) || 1;
  const head = rows.slice(0, limit);
  const tail = rows.slice(limit);
  if (tail.length > 0) {
    head.push({
      label: "其他",
      sets: tail.reduce((sum, row) => sum + row.sets, 0),
      reps: tail.reduce((sum, row) => sum + row.reps, 0),
    });
  }
  return head.map((row) => ({ ...row, pct: Math.max(0, Math.min(100, Math.round((row.sets / totalSets) * 100))) }));
}

/** 最近训练（按日期倒序，同日后加的在前） */
export function recentWorkouts(workouts: Workout[], limit = 4): Workout[] {
  return [...workouts]
    .sort((a, b) => (dayKey(a) === dayKey(b) ? b.id - a.id : dayKey(b).localeCompare(dayKey(a))))
    .slice(0, limit);
}


