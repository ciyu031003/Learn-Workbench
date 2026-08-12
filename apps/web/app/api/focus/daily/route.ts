import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { todayISO } from "@learn-workbench/shared";

export async function GET() {
  const uid = await currentUserId();
  const today = todayISO();

  const { rows: todayRows } = await pgPool.query<{ cnt: number; total_seconds: number }>(
    `SELECT COUNT(*)::int AS cnt, COALESCE(SUM(duration_seconds), 0)::int AS total_seconds
     FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1
       AND (started_at AT TIME ZONE 'Asia/Shanghai')::date = $2::date
       AND duration_seconds IS NOT NULL`,
    [uid, today]
  );

  const { rows: daysRows } = await pgPool.query<{ d: string; cnt: number; secs: number }>(
    `SELECT to_char((started_at AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM-DD') AS d,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(duration_seconds), 0)::int AS secs
     FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1 AND duration_seconds IS NOT NULL
     GROUP BY d ORDER BY d DESC`,
    [uid]
  );

  const { rows: todayList } = await pgPool.query<{ start_time: string; end_time: string; minutes: number }>(
    `SELECT to_char(started_at AT TIME ZONE 'Asia/Shanghai', 'HH24:MI') AS start_time,
            to_char(ended_at AT TIME ZONE 'Asia/Shanghai', 'HH24:MI') AS end_time,
            COALESCE(ROUND(duration_seconds / 60.0), 0)::int AS minutes
     FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1
       AND (started_at AT TIME ZONE 'Asia/Shanghai')::date = $2::date
       AND duration_seconds IS NOT NULL
     ORDER BY started_at`,
    [uid, today]
  );

  // 本地日期格式化（避免 toISOString 的 UTC 偏移）
  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // 连续专注天数：从今天（若今天没有则从昨天）向前数连续有记录的天数
  const daySet = new Set(daysRows.map((r) => r.d));
  let streak = 0;
  const cursor = new Date(today + "T00:00:00");
  if (!daySet.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(localKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 最近 14 天分布
  const last14: { date: string; minutes: number; sessions: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - i);
    const key = localKey(d);
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
