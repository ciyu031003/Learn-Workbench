import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import type { JobRun } from "@learn-workbench/shared";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { rows } = await pgPool.query(
    "SELECT id, started_at, finished_at, status, platforms_result, fetched_count, new_count, error FROM job_crawler_runs ORDER BY started_at DESC LIMIT 10"
  );
  const runs: JobRun[] = rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status as JobRun["status"],
    platformsResult: r.platforms_result ?? {},
    fetchedCount: r.fetched_count,
    newCount: r.new_count,
    error: r.error ?? null,
  }));
  return NextResponse.json({ runs });
}
