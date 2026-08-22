import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 10)));
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, limit]);
  const { rows } = await pgPool.query(
    `SELECT id, level, note, source, recorded_at AS "recordedAt"
     FROM energy_logs
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND deleted_at IS NULL
     ORDER BY recorded_at DESC LIMIT $2`,
    w.params
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
  const scope = await userScope();
  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO energy_logs (user_id, level, note, source) VALUES ($1, $2, $3, $4)
       RETURNING id, level, note, source, recorded_at AS "recordedAt"`,
      [scope.uid, level, note, source]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO energy_logs (user_id, anon_id, level, note, source) VALUES (NULL, $1, $2, $3, $4)
       RETURNING id, level, note, source, recorded_at AS "recordedAt"`,
      [scope.anonId, level, note, source]
    ));
  }
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}