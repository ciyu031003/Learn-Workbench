import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import type { JobStats } from "@learn-workbench/shared";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { rows } = await pgPool.query(
    "SELECT " +
      "(SELECT count(*)::int FROM job_postings WHERE is_active = true) AS total, " +
      "(SELECT count(*)::int FROM job_postings WHERE is_active = true AND fetched_at >= now() - interval '24 hours') AS today_new, " +
      "(SELECT count(DISTINCT source)::int FROM job_postings WHERE is_active = true) AS platform_count, " +
      "(SELECT started_at FROM job_crawler_runs ORDER BY started_at DESC LIMIT 1) AS last_run, " +
      "(SELECT status FROM job_crawler_runs ORDER BY started_at DESC LIMIT 1) AS last_run_status"
  );
  const r = rows[0];
  const stats: JobStats = {
    total: r.total,
    todayNew: r.today_new,
    platformCount: r.platform_count,
    lastRun: r.last_run ? new Date(r.last_run).toISOString() : null,
    lastRunStatus: r.last_run_status ?? null,
  };
  return NextResponse.json(stats);
}
