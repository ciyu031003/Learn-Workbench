import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const careerParam = url.searchParams.get("career");
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  let career = "ict";
  if (careerParam) {
    career = careerParam;
  } else if (uid) {
    const { rows } = await pgPool.query<{ value: unknown }>(
      `SELECT value FROM settings WHERE user_id = $1 AND key = $2`,
      [uid, "career"]
    );
    if (rows[0]?.value) career = String(rows[0].value);
  }
  const params: unknown[] = [uid, career];
  let anonSql = "";
  if (!uid) {
    params.push(anonId);
    anonSql = ` AND ${anonFilterSql(params.length + 1)}`;
  }
  const { rows } = await pgPool.query<{
    phase_id: number | null;
    phase_title: string | null;
    total_seconds: number;
    session_count: number;
  }>(
    `SELECT t.phase_id,
            COALESCE(p.title, '未分类') AS phase_title,
            COALESCE(SUM(f.duration_seconds), 0) AS total_seconds,
            COUNT(*) AS session_count
     FROM focus_sessions f
     LEFT JOIN daily_tasks t ON t.id = f.task_id
     LEFT JOIN content_phases p ON p.id = t.phase_id
     WHERE f.user_id IS NOT DISTINCT FROM $1${anonSql}
       AND t.career_key = $2
       AND f.duration_seconds IS NOT NULL
     GROUP BY t.phase_id, p.title
     ORDER BY total_seconds DESC`,
    params
  );
  return NextResponse.json({
    stats: rows.map((r) => ({
      phaseId: r.phase_id,
      phaseTitle: r.phase_title ?? "未分类",
      totalMinutes: Math.round(r.total_seconds / 60),
      sessionCount: r.session_count,
    })),
  });
}