import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { todayISO } from "@learn-workbench/shared";
import { buildTodayPlan } from "@/lib/wellbeing";

export async function GET() {
  const uid = await currentUserId();
  const date = todayISO();

  // 饮水
  const hydration = await pgPool.query(
    `SELECT id, amount_ml AS "amountMl", source, recorded_at AS "recordedAt"
     FROM hydration_logs
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL
       AND recorded_at >= $2::date AND recorded_at < ($2::date + 1)
     ORDER BY recorded_at`,
    [uid, date]
  );
  const totalMl = hydration.rows.reduce((a: number, r: { amountMl: number }) => a + r.amountMl, 0);
  const goal = await pgPool.query(
    `SELECT id, target_ml AS "targetMl" FROM hydration_goals
     WHERE user_id IS NOT DISTINCT FROM $1 AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    [uid, date]
  );

  // 精力（最近一条）
  const energy = await pgPool.query(
    `SELECT id, level, note, source, recorded_at AS "recordedAt"
     FROM energy_logs
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL
     ORDER BY recorded_at DESC LIMIT 1`,
    [uid]
  );

  // 今日专注（秒 → 分钟）
  const focus = await pgPool.query(
    `SELECT COALESCE(SUM(duration_seconds), 0) AS seconds FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)`,
    [uid, date]
  );
  const focusMinutes = Math.round(Number(focus.rows[0]?.seconds ?? 0) / 60);

  // 今日休息
  const breaks = await pgPool.query(
    `SELECT id, kind, minutes, note, started_at AS "startedAt"
     FROM break_sessions
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)
     ORDER BY started_at`,
    [uid, date]
  );

  // 提醒：启用且 next_trigger_at 在接下来 30 分钟内视为“即将触发”
  const dueFrom = new Date().toISOString();
  const dueTo = new Date(Date.now() + 30 * 60000).toISOString();
  const reminders = await pgPool.query(
    `SELECT id, type, title, message, enabled, interval_minutes AS "intervalMinutes",
            start_time AS "startTime", end_time AS "endTime", weekdays, next_trigger_at AS "nextTriggerAt"
     FROM wellbeing_reminders
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL AND enabled = true
       AND next_trigger_at IS NOT NULL AND next_trigger_at BETWEEN $2 AND $3
     ORDER BY next_trigger_at`,
    [uid, dueFrom, dueTo]
  );

  // Today Engine：专注 >= 50 分钟且 30 分钟内没有休息 → 建议休息
  const lastBreak = breaks.rows[breaks.rows.length - 1];
  const breakDue =
    focusMinutes >= 50 &&
    (!lastBreak || Date.now() - new Date(lastBreak.startedAt).getTime() > 30 * 60000);

  const plan = buildTodayPlan({
    focusMinutes,
    energyLevel: energy.rows[0]?.level ?? null,
    breakDue,
  });

  return NextResponse.json({
    date,
    hydration: { totalMl, targetMl: goal.rows[0]?.targetMl ?? 2000, logs: hydration.rows },
    energy: energy.rows[0] ?? null,
    focusTodayMinutes: focusMinutes,
    breaksToday: breaks.rows,
    nextBreakDue: breakDue,
    remindersDue: reminders.rows,
    plan,
  });
}
