import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql, userScope, scopeWhere } from "@/lib/anon";
import { computeReadiness } from "@/lib/readiness";
import { buildTodayPlan } from "@/lib/wellbeing";
import { todayISO } from "@learn-workbench/shared";
import { addDaysToDateKey, computeStreak, dateKeyInZone } from "@learn-workbench/shared/domains";
import type { CareerReadiness, DashboardSummary, WellbeingToday } from "@learn-workbench/shared/schemas";

/**
 * Dashboard / Wellbeing 的服务端取数（S6-2）。
 *
 * 从原 API 路由抽出，供两处复用：
 *  - (app)/dashboard/page.tsx（Server Component 直调，首屏不再发 XHR）；
 *  - /api/dashboard、/api/wellbeing/today（保留为兼容 API，内部委托本文件）。
 *
 * 约束：响应 shape / SQL / 权限范围与抽出前完全一致；本文件只服务端使用，
 * 不要把 zod/大包带入客户端（Server Component 只把它的**返回值**传给客户端组件）。
 */

interface TopicRow { id: number; phase_id: number; }
interface DoneRow { topic_id: number; }
interface PhaseRow { id: number; phase_key: string; title: string; track: "main" | "agent"; }
interface TaskRow {
  id: number; task_date: string; title: string; phase_id: number | null; topic_id: number | null;
  task_type: string; done: boolean; focus_minutes: number; sort_order: number;
}
interface CheckinRow { checkin_date: string; }

/** 匿名作用域：未登录时在 user_id 过滤之外追加 anon_id 过滤（含遗留行） */
function anonScope(uid: string | null, anonId: string | null, base: unknown[]): { params: unknown[]; sql: string } {
  const params = [...base];
  if (uid) return { params, sql: "" };
  params.push(anonId);
  return { params, sql: ` AND ${anonFilterSql(params.length)}` };
}

export interface DashboardPayload {
  summary: DashboardSummary;
  readiness: CareerReadiness;
  jobsTotal: number;
}

/**
 * 仪表盘聚合（原 /api/dashboard 逻辑，逐行搬移）。
 * 使用 pgPool.connect() 让多条查询走同一连接（与抽前一致；测试也按此 mock）。
 */
export async function buildDashboardPayload(): Promise<DashboardPayload> {
  const client = await pgPool.connect();
  try {
    const uid = await currentUserId();
    const anonId = uid ? null : await getAnonId();
    // S5-1：业务日期/streak 统一走 shared/domains（东八区口径，与页面/移动端一致）
    const now = new Date();
    const today = dateKeyInZone(now);
    const weekStart = addDaysToDateKey(today, -6);

    // 当前职业
    let career = "ict";
    let careerName = "ICT 学习规划";
    if (uid) {
      const careerRow = await client.query<{ value: unknown }>(
        `SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`,
        [uid]
      );
      if (careerRow.rows[0]?.value) career = String(careerRow.rows[0].value);
    }
    const careerInfo = await client.query<{ name: string }>(
      `SELECT name FROM careers WHERE career_key = $1`,
      [career]
    );
    if (careerInfo.rows[0]) careerName = careerInfo.rows[0].name;

    const topicsResult = await client.query<TopicRow>(
      `SELECT id, phase_id FROM content_topics
       WHERE (is_custom = FALSE OR owner_id = $1)
         AND phase_id IN (SELECT id FROM content_phases WHERE career_key = $2)`,
      [uid, career]
    );
    const doneScope = anonScope(uid, anonId, [uid]);
    const doneResult = await client.query<DoneRow>(
      `SELECT topic_id FROM topic_progress WHERE user_id IS NOT DISTINCT FROM $1${doneScope.sql} AND done = true`,
      doneScope.params
    );
    const doneIds = new Set(doneResult.rows.map((r) => r.topic_id));
    const phaseCounts = new Map<number, { total: number; done: number }>();
    let total = 0;
    let doneTotal = 0;
    for (const t of topicsResult.rows) {
      const c = phaseCounts.get(t.phase_id) ?? { total: 0, done: 0 };
      c.total += 1; total += 1;
      if (doneIds.has(t.id)) { c.done += 1; doneTotal += 1; }
      phaseCounts.set(t.phase_id, c);
    }

    const phasesResult = await client.query<PhaseRow>(
      `SELECT id, phase_key, title, track FROM content_phases
       WHERE career_key = $1 ORDER BY track, sort_order, id`,
      [career]
    );
    const todayTasksScope = anonScope(uid, anonId, [uid, today]);
    const todayTasksResult = await client.query<TaskRow>(
      `SELECT id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order
       FROM daily_tasks WHERE user_id IS NOT DISTINCT FROM $1${todayTasksScope.sql} AND task_date = $2 ORDER BY sort_order, id`,
      todayTasksScope.params
    );
    const weekTasksScope = anonScope(uid, anonId, [uid, weekStart, today]);
    const weekTasksResult = await client.query<{ done: boolean }>(
      `SELECT done FROM daily_tasks WHERE user_id IS NOT DISTINCT FROM $1${weekTasksScope.sql} AND task_date BETWEEN $2 AND $3`,
      weekTasksScope.params
    );
    const focusScope = anonScope(uid, anonId, [uid, weekStart]);
    const focusResult = await client.query<{ s: number }>(
      `SELECT COALESCE(SUM(duration_seconds), 0)::int AS s FROM focus_sessions
       WHERE user_id IS NOT DISTINCT FROM $1${focusScope.sql} AND started_at >= $2`,
      focusScope.params
    );
    const checkinsScope = anonScope(uid, anonId, [uid]);
    const checkinsResult = await client.query<CheckinRow>(
      `SELECT checkin_date FROM checkins WHERE user_id IS NOT DISTINCT FROM $1${checkinsScope.sql} ORDER BY checkin_date DESC`,
      checkinsScope.params
    );
    const xpScope = anonScope(uid, anonId, [uid]);
    const xpResult = await client.query<{ x: number }>(
      `SELECT COALESCE(SUM(amount), 0)::int AS x FROM xp_events WHERE user_id IS NOT DISTINCT FROM $1${xpScope.sql}`,
      xpScope.params
    );
    const certsScope = anonScope(uid, anonId, [uid]);
    const certsResult = await client.query<{ id: number; name: string; target_date: string | null; status: string; note: string | null }>(
      `SELECT id, name, target_date, status, note FROM certificates WHERE user_id IS NOT DISTINCT FROM $1${certsScope.sql} ORDER BY target_date NULLS LAST`,
      certsScope.params
    );
    const logsScope = anonScope(uid, anonId, [uid, weekStart]);
    const logsResult = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM log_entries WHERE user_id IS NOT DISTINCT FROM $1${logsScope.sql} AND created_at >= $2`,
      logsScope.params
    );
    const jobsResult = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM job_postings WHERE is_active = true`,
      []
    );

    const summary: DashboardSummary = {
      career,
      careerName,
      overallPercent: total > 0 ? Math.round((doneTotal / total) * 100) : 0,
      phases: phasesResult.rows.map((p) => {
        const c = phaseCounts.get(p.id) ?? { total: 0, done: 0 };
        return {
          phaseId: p.id, phaseKey: p.phase_key, title: p.title, track: p.track,
          total: c.total, done: c.done,
          percent: c.total > 0 ? Math.round((c.done / c.total) * 100) : 0,
        };
      }),
      // ⚠️ 保持 API 响应 shape 不变：与原 /api/dashboard 一样直接返回 SQL 行（snake_case）
      todayTasks: todayTasksResult.rows as unknown as DashboardSummary["todayTasks"],
      weekTaskCount: weekTasksResult.rows.length,
      weekTaskDone: weekTasksResult.rows.filter((r) => r.done).length,
      streak: computeStreak(checkinsResult.rows.map((r) => r.checkin_date), { now }),
      totalFocusMinutes: Math.round(Number(focusResult.rows[0]?.s ?? 0) / 60),
      xp: Number(xpResult.rows[0]?.x ?? 0),
      certificates: certsResult.rows,
      logsThisWeek: Number(logsResult.rows[0]?.n ?? 0),
    } as unknown as DashboardSummary;
    const readiness = await computeReadiness(uid, anonId);
    return { summary, readiness, jobsTotal: Number(jobsResult.rows[0]?.n ?? 0) };
  } finally {
    client.release();
  }
}

/** 今日健康/精力聚合（原 /api/wellbeing/today 逻辑，逐行搬移） */
export async function buildWellbeingToday(): Promise<WellbeingToday> {
  const scope = await userScope();
  const date = todayISO();

  // 饮水
  const w1 = scopeWhere(scope, [scope.uid, date]);
  const hydration = await pgPool.query(
    `SELECT id, amount_ml AS "amountMl", source, recorded_at AS "recordedAt"
     FROM hydration_logs
     WHERE user_id IS NOT DISTINCT FROM $1${w1.sql} AND deleted_at IS NULL
       AND recorded_at >= $2::date AND recorded_at < ($2::date + 1)
     ORDER BY recorded_at`,
    w1.params
  );
  const totalMl = hydration.rows.reduce((a: number, r: { amountMl: number }) => a + r.amountMl, 0);
  const w2 = scopeWhere(scope, [scope.uid, date]);
  const goal = await pgPool.query(
    `SELECT id, target_ml AS "targetMl" FROM hydration_goals
     WHERE user_id IS NOT DISTINCT FROM $1${w2.sql} AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    w2.params
  );

  // 精力（最近一条）
  const w3 = scopeWhere(scope, [scope.uid]);
  const energy = await pgPool.query(
    `SELECT id, level, note, source, recorded_at AS "recordedAt"
     FROM energy_logs
     WHERE user_id IS NOT DISTINCT FROM $1${w3.sql} AND deleted_at IS NULL
     ORDER BY recorded_at DESC LIMIT 1`,
    w3.params
  );

  // 今日专注（秒 → 分钟）
  const w4 = scopeWhere(scope, [scope.uid, date]);
  const focus = await pgPool.query(
    `SELECT COALESCE(SUM(duration_seconds), 0) AS seconds FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1${w4.sql} AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)`,
    w4.params
  );
  const focusMinutes = Math.round(Number(focus.rows[0]?.seconds ?? 0) / 60);

  // 今日休息
  const w5 = scopeWhere(scope, [scope.uid, date]);
  const breaks = await pgPool.query(
    `SELECT id, kind, minutes, note, started_at AS "startedAt"
     FROM break_sessions
     WHERE user_id IS NOT DISTINCT FROM $1${w5.sql} AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)
     ORDER BY started_at`,
    w5.params
  );

  // 今日运动（健康模块小类）：记录 + 当日汇总 + 目标
  const w5b = scopeWhere(scope, [scope.uid, date]);
  const exercise = await pgPool.query(
    `SELECT id, type, type_label AS "typeLabel", duration_seconds AS "durationSeconds",
            source, note, started_at AS "startedAt"
     FROM exercise_logs
     WHERE user_id IS NOT DISTINCT FROM $1${w5b.sql} AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)
     ORDER BY started_at`,
    w5b.params
  );
  const exerciseSeconds = exercise.rows.reduce((a: number, r: { durationSeconds: number }) => a + r.durationSeconds, 0);
  const w5c = scopeWhere(scope, [scope.uid, date]);
  const exerciseGoal = await pgPool.query(
    `SELECT id, target_minutes AS "targetMinutes" FROM exercise_goals
     WHERE user_id IS NOT DISTINCT FROM $1${w5c.sql} AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    w5c.params
  );
  // 提醒：启用且 next_trigger_at 在接下来 30 分钟内视为“即将触发”
  const dueFrom = new Date().toISOString();
  const dueTo = new Date(Date.now() + 30 * 60000).toISOString();
  const w6 = scopeWhere(scope, [scope.uid, dueFrom, dueTo]);
  const reminders = await pgPool.query(
    `SELECT id, type, title, message, enabled, interval_minutes AS "intervalMinutes",
            start_time AS "startTime", end_time AS "endTime", weekdays, next_trigger_at AS "nextTriggerAt"
     FROM wellbeing_reminders
     WHERE user_id IS NOT DISTINCT FROM $1${w6.sql} AND deleted_at IS NULL AND enabled = true
       AND next_trigger_at IS NOT NULL AND next_trigger_at BETWEEN $2 AND $3
     ORDER BY next_trigger_at`,
    w6.params
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
    exerciseMinutes: Math.round(exerciseSeconds / 60),
    exerciseTargetMinutes: exerciseGoal.rows[0]?.targetMinutes ?? 30,
  });

  return {
    date,
    hydration: { totalMl, targetMl: goal.rows[0]?.targetMl ?? 2000, logs: hydration.rows },
    energy: energy.rows[0] ?? null,
    focusTodayMinutes: focusMinutes,
    breaksToday: breaks.rows,
    nextBreakDue: breakDue,
    remindersDue: reminders.rows,
    exercise: {
      totalMinutes: Math.round(exerciseSeconds / 60),
      totalSeconds: exerciseSeconds,
      targetMinutes: exerciseGoal.rows[0]?.targetMinutes ?? 30,
      logs: exercise.rows,
    },
    plan,
  } as unknown as WellbeingToday;
}

export interface DashboardPageData {
  summary: DashboardSummary;
  readiness: CareerReadiness;
  wellbeing: WellbeingToday;
}

/** Server Component 首屏数据：一次返回 summary/readiness/wellbeing（并行） */
export async function getDashboardPageData(): Promise<DashboardPageData> {
  const [payload, wellbeing] = await Promise.all([buildDashboardPayload(), buildWellbeingToday()]);
  return { summary: payload.summary, readiness: payload.readiness, wellbeing };
}
