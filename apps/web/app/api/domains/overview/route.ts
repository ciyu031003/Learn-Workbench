import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";

/** 领域投入概览：当前领域 记录项数 + 今日记录数 + 今日投入值合计 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const career = url.searchParams.get("career") || "ict";
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  const params: unknown[] = [uid, career];
  let anonSql = "";
  if (!uid) {
    anonSql = ` AND ${anonFilterSql(params.length + 1)}`;
    params.push(anonId);
  }
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pgPool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM domain_trackers
     WHERE user_id IS NOT DISTINCT FROM $1 AND domain_key = $2 AND deleted_at IS NULL${anonSql}`,
    params
  );
  const trackerCount = Number(rows[0]?.n ?? 0);
  let todayCount = 0;
  let todayValue = 0;
  if (trackerCount > 0) {
    const { rows: lr } = await pgPool.query<{ n: string; s: string | null }>(
      `SELECT COUNT(*)::text AS n, SUM(l.value)::text AS s
       FROM tracker_logs l
       JOIN domain_trackers t ON t.id = l.tracker_id
       WHERE l.user_id IS NOT DISTINCT FROM $1 AND t.domain_key = $2 AND l.log_date = $3 AND t.deleted_at IS NULL${anonSql}`,
      [...params, today]
    );
    todayCount = Number(lr[0]?.n ?? 0);
    todayValue = Number(lr[0]?.s ?? 0);
  }
  return NextResponse.json({ career, trackerCount, todayCount, todayValue });
}
