import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { todayISO } from "@learn-workbench/shared";

interface TopicRow {
  id: number;
  phase_id: number;
}

interface DoneRow {
  topic_id: number;
}

interface PhaseRow {
  id: number;
  phase_key: string;
  title: string;
  track: "main" | "agent";
}

interface TaskRow {
  id: number;
  task_date: string;
  title: string;
  phase_id: number | null;
  topic_id: number | null;
  task_type: string;
  done: boolean;
  focus_minutes: number;
  sort_order: number;
}

interface CheckinRow {
  checkin_date: string;
}

function computeStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date(today + "T00:00:00");
  if (!set.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function GET() {
  const client = await pgPool.connect();
  try {
    const today = todayISO();
    const weekAgo = new Date(today + "T00:00:00");
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekStart = weekAgo.toISOString().slice(0, 10);

    const topicsResult = await client.query<TopicRow>(`SELECT id, phase_id FROM content_topics`);
    const doneResult = await client.query<DoneRow>(
      `SELECT topic_id FROM topic_progress WHERE user_id IS NULL AND done = true`
    );
    const doneIds = new Set(doneResult.rows.map((r) => r.topic_id));
    const phaseCounts = new Map<number, { total: number; done: number }>();
    let total = 0;
    let doneTotal = 0;
    for (const t of topicsResult.rows) {
      const c = phaseCounts.get(t.phase_id) ?? { total: 0, done: 0 };
      c.total += 1;
      total += 1;
      if (doneIds.has(t.id)) {
        c.done += 1;
        doneTotal += 1;
      }
      phaseCounts.set(t.phase_id, c);
    }

    const phasesResult = await client.query<PhaseRow>(
      `SELECT id, phase_key, title, track FROM content_phases ORDER BY track, sort_order, id`
    );

    const todayTasksResult = await client.query<TaskRow>(
      `SELECT id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order
       FROM daily_tasks WHERE user_id IS NULL AND task_date = $1 ORDER BY sort_order, id`,
      [today]
    );

    const weekTasksResult = await client.query<{ done: boolean }>(
      `SELECT done FROM daily_tasks WHERE user_id IS NULL AND task_date BETWEEN $1 AND $2`,
      [weekStart, today]
    );

    const focusResult = await client.query<{ s: number }>(
      `SELECT COALESCE(SUM(duration_seconds), 0)::int AS s
       FROM focus_sessions WHERE user_id IS NULL AND started_at >= $1`,
      [weekStart]
    );

    const checkinsResult = await client.query<CheckinRow>(
      `SELECT checkin_date FROM checkins WHERE user_id IS NULL ORDER BY checkin_date DESC`
    );

    const xpResult = await client.query<{ x: number }>(
      `SELECT COALESCE(SUM(amount), 0)::int AS x FROM xp_events WHERE user_id IS NULL`
    );

    const certsResult = await client.query<{
      id: number;
      name: string;
      target_date: string | null;
      status: string;
      note: string | null;
    }>(`SELECT id, name, target_date, status, note FROM certificates WHERE user_id IS NULL ORDER BY target_date NULLS LAST`);

    const logsResult = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM log_entries WHERE user_id IS NULL AND created_at >= $1`,
      [weekStart]
    );

    return NextResponse.json({
      overallPercent: total > 0 ? Math.round((doneTotal / total) * 100) : 0,
      phases: phasesResult.rows.map((p) => {
        const c = phaseCounts.get(p.id) ?? { total: 0, done: 0 };
        return {
          phaseId: p.id,
          phaseKey: p.phase_key,
          title: p.title,
          track: p.track,
          total: c.total,
          done: c.done,
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
    });
  } catch (e) {
    console.error("summary api error", e);
    return NextResponse.json({ error: "数据库暂不可用" }, { status: 500 });
  } finally {
    client.release();
  }
}
