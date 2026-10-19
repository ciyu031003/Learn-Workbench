import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";
import { addDaysToDateKey, computeStreak, dateKeyInZone } from "@learn-workbench/shared/domains";

export async function GET() {
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  const now = new Date();
  const today = dateKeyInZone(now);

  const scope = (baseParams: unknown[]): { params: unknown[]; sql: string } => {
    const params = [...baseParams];
    if (!uid) {
      params.push(anonId);
      return { params, sql: ` AND ${anonFilterSql(params.length)}` };
    }
    return { params, sql: "" };
  };

  const s1 = scope([uid, today]);
  const { rows: todayRows } = await pgPool.query<{ cnt: number; total_seconds: number }>(
    `SELECT COUNT(*)::int AS cnt, COALESCE(SUM(duration_seconds), 0)::int AS total_seconds
     FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1${s1.sql}
       AND (started_at AT TIME ZONE 'Asia/Shanghai')::date = $2::date
       AND duration_seconds IS NOT NULL`,
    s1.params
  );

  const s2 = scope([uid]);
  const { rows: daysRows } = await pgPool.query<{ d: string; cnt: number; secs: number }>(
    `SELECT to_char((started_at AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM-DD') AS d,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(duration_seconds), 0)::int AS secs
     FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1${s2.sql} AND duration_seconds IS NOT NULL
     GROUP BY d ORDER BY d DESC`,
    s2.params
  );

  const s3 = scope([uid, today]);
  const { rows: todayList } = await pgPool.query<{ start_time: string; end_time: string; minutes: number }>(
    `SELECT to_char(started_at AT TIME ZONE 'Asia/Shanghai', 'HH24:MI') AS start_time,
            to_char(ended_at AT TIME ZONE 'Asia/Shanghai', 'HH24:MI') AS end_time,
            COALESCE(ROUND(duration_seconds / 60.0), 0)::int AS minutes
     FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1${s3.sql}
       AND (started_at AT TIME ZONE 'Asia/Shanghai')::date = $2::date
       AND duration_seconds IS NOT NULL
     ORDER BY started_at`,
    s3.params
  );

  // S5-1：连续天数 / 日期键都走 shared/domains（与 dashboard、移动端同口径）
  const streak = computeStreak(daysRows.map((r) => r.d), { now });

  const last14: { date: string; minutes: number; sessions: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const key = addDaysToDateKey(today, -i);
    const found = daysRows.find((r) => r.d === key);
    last14.push({ date: key, minutes: found ? Math.round(found.secs / 60) : 0, sessions: found ? found.cnt : 0 });
  }

  return NextResponse.json({
    date: today,
    todaySessions: todayRows[0]?.cnt ?? 0,
    todayMinutes: Math.round((todayRows[0]?.total_seconds ?? 0) / 60),
    totalFocusDays: daysRows.length,
    streak,
    last14,
    todayList,
  });
}