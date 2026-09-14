import { pgPool } from "@/lib/db";
import { scopeWhere } from "@/lib/anon";
import {
  computeHabitStats,
  isScheduled,
  type Habit,
  type HabitLog,
  type HabitStats,
} from "@learn-workbench/shared";

export interface Scope {
  uid: string | null;
  anonId: string | null;
}

const HABIT_COLS = `id, name, icon, is_boolean AS "isBoolean", target_value AS "targetValue",
  unit, schedule, color, sort_order AS "sortOrder", archived_at AS "archivedAt", updated_at AS "updatedAt"`;

/** 未归档且未删除的习惯（按排序） */
export async function listHabits(scope: Scope): Promise<Habit[]> {
  const w = scopeWhere(scope, [scope.uid]);
  const { rows } = await pgPool.query(
    `SELECT ${HABIT_COLS} FROM habits
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql}
        AND deleted_at IS NULL AND archived_at IS NULL
      ORDER BY sort_order, id`,
    w.params
  );
  return rows.map((r) => ({
    ...r,
    targetValue: r.targetValue === null || r.targetValue === undefined ? null : Number(r.targetValue),
    schedule: Array.isArray(r.schedule) ? r.schedule.map(Number) : [0, 1, 2, 3, 4, 5, 6],
  })) as Habit[];
}

/** 区间内的打卡记录 */
export async function listLogs(scope: Scope, from: string, to: string): Promise<HabitLog[]> {
  const base: unknown[] = [scope.uid, from, to];
  const w = scopeWhere(scope, base);
  const { rows } = await pgPool.query(
    `SELECT habit_id AS "habitId", log_date AS "logDate", value, note
       FROM habit_logs
      WHERE user_id IS NOT DISTINCT FROM $1
        AND log_date >= $2::date AND log_date <= $3::date${w.sql}`,
    w.params
  );
  return rows.map((r) => ({
    habitId: Number(r.habitId),
    logDate: String(r.logDate).slice(0, 10),
    value: Number(r.value),
    note: r.note ?? null,
  }));
}

/** 习惯 + 统计 + 近 90 天打卡（一次取回，前端画周条与热力图） */
export async function listHabitsWithStats(
  scope: Scope,
  today: Date = new Date()
): Promise<{ habits: Habit[]; logs: HabitLog[]; stats: HabitStats[] }> {
  const habits = await listHabits(scope);
  if (habits.length === 0) return { habits: [], logs: [], stats: [] };

  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  from.setDate(from.getDate() - 89);
  const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const toKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const logs = await listLogs(scope, fromKey, toKey);
  const stats = habits.map((h) => computeHabitStats(h, logs, today));
  return { habits, logs, stats };
}

/** 今日应打卡的习惯数（供 Daily OS 聚合） */
export function countScheduledToday(habits: Habit[], today: Date = new Date()): number {
  return habits.filter((h) => isScheduled(h.schedule, today)).length;
}