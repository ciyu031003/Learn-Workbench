import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 10)));
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT id, level, note, source, recorded_at AS "recordedAt"
     FROM energy_logs
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL
     ORDER BY recorded_at DESC LIMIT $2`,
    [uid, limit]
  );
  return NextResponse.json({ logs: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const level = Number(body?.level);
  if (!Number.isFinite(level) || level < 1 || level > 5) {
    return NextResponse.json({ error: "精力等级需在 1-5 之间" }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  const source = ["MANUAL", "AFTER_FOCUS", "MORNING"].includes(body?.source) ? String(body.source) : "MANUAL";
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `INSERT INTO energy_logs (user_id, level, note, source) VALUES ($1, $2, $3, $4)
     RETURNING id, level, note, source, recorded_at AS "recordedAt"`,
    [uid, level, note, source]
  );
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}
