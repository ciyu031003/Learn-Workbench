import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { computeReadiness } from "@/lib/readiness";
import { getAnonId, anonFilterSql } from "@/lib/anon";
import { pgPool } from "@/lib/db";

interface TopicRow { id: number; phase_id: number; }
interface DoneRow { topic_id: number; }
interface PhaseRow { id: number; phase_key: string; title: string; track: "main" | "agent"; }
interface TaskRow {
  id: number; task_date: string; title: string; phase_id: number | null; topic_id: number | null;
  task_type: string; done: boolean; focus_minutes: number; sort_order: number;
}
interface CheckinRow { checkin_date: string; }

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date(today + "T00:00:00");
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (set.has(localKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 匿名作用域：未登录时在 user_id 过滤之外追加 anon_id 过滤（含遗留行） */
function anonScope(uid: string | null, anonId: string | null, base: unknown[]): { params: unknown[]; sql: string } {
  const params = [...base];
  if (uid) return { params, sql: "" };
  params.push(anonId);
  return { params, sql: ` AND ${anonFilterSql(params.length)}` };
}

export async function GET() {
  let client;
  try {
    client = await pgPool.connect();
    const uid = await currentUserId();
    const anonId = uid ? null : await getAnonId();
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(today + "T00:00:00");
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekStart = localKey(weekAgo);

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

    const summary = {
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
      todayTasks: todayTasksResult.rows,
      weekTaskCount: weekTasksResult.rows.length,
      weekTaskDone: weekTasksResult.rows.filter((r) => r.done).length,
      streak: computeStreak(checkinsResult.rows.map((r) => r.checkin_date), today),
      totalFocusMinutes: Math.round(Number(focusResult.rows[0]?.s ?? 0) / 60),
      xp: Number(xpResult.rows[0]?.x ?? 0),
      certificates: certsResult.rows,
      logsThisWeek: Number(logsResult.rows[0]?.n ?? 0),
    };
    const readiness = await computeReadiness(uid, anonId);
    return NextResponse.json({ summary, readiness, jobsTotal: Number(jobsResult.rows[0]?.n ?? 0) });
  } catch (e) {
    console.error("dashboard api error", e);
    return NextResponse.json({ error: "数据库暂不可用" }, { status: 500 });
  } finally {
    client?.release();
  }
}