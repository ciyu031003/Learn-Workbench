import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";

/** 记录项按日打卡：GET 列出（含今日/最近一条）；POST upsert（同一天重复记录覆盖） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const trackerId = Number(url.searchParams.get("trackerId"));
  const limit = Math.min(90, Math.max(1, Number(url.searchParams.get("limit") || 30)));
  if (!Number.isFinite(trackerId)) return NextResponse.json({ error: "trackerId 无效" }, { status: 400 });
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  const params: unknown[] = [uid, trackerId, limit];
  let anonSql = "";
  if (!uid) {
    anonSql = ` AND ${anonFilterSql(params.length + 1)}`;
    params.push(anonId);
  }
  const { rows } = await pgPool.query(
    `SELECT l.id, l.tracker_id, l.log_date, l.value, l.note
     FROM tracker_logs l
     JOIN domain_trackers t ON t.id = l.tracker_id
     WHERE l.user_id IS NOT DISTINCT FROM $1 AND l.tracker_id = $2 AND t.deleted_at IS NULL${anonSql}
     ORDER BY l.log_date DESC LIMIT $3`,
    params
  );
  return NextResponse.json({ logs: rows });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const trackerId = Number(body?.trackerId);
  const logDate = String(body?.logDate || "");
  const value = Number(body?.value ?? 0);
  const note = String(body?.note || "").trim() || null;
  if (!Number.isFinite(trackerId)) return NextResponse.json({ error: "trackerId 无效" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return NextResponse.json({ error: "日期格式无效" }, { status: 400 });
  if (!Number.isFinite(value)) return NextResponse.json({ error: "数值无效" }, { status: 400 });
  const owned = await pgPool.query<{ id: number }>(
    `SELECT id FROM domain_trackers WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [trackerId, uid]
  );
  if (!owned.rows[0]) return NextResponse.json({ error: "记录项不存在" }, { status: 404 });
  const { rows } = await pgPool.query(
    `INSERT INTO tracker_logs (user_id, tracker_id, log_date, value, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, tracker_id, log_date) DO UPDATE SET
       value = EXCLUDED.value, note = EXCLUDED.note, updated_at = now()
     RETURNING id, tracker_id, log_date, value, note`,
    [uid, trackerId, logDate, value, note]
  );
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}
