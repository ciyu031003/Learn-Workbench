import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { todayISO } from "@learn-workbench/shared";

const KINDS = ["SHORT", "LONG", "MOVEMENT", "EYE_REST", "MEAL"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISO();
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, date]);
  const { rows } = await pgPool.query(
    `SELECT id, kind, minutes, note, started_at AS "startedAt"
     FROM break_sessions
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)
     ORDER BY started_at`,
    w.params
  );
  return NextResponse.json({ breaks: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kind = KINDS.includes(body?.kind) ? String(body.kind) : "SHORT";
  const minutes = Math.min(240, Math.max(1, Number(body?.minutes) || 5));
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  const scope = await userScope();
  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO break_sessions (user_id, kind, minutes, note) VALUES ($1, $2, $3, $4)
       RETURNING id, kind, minutes, note, started_at AS "startedAt"`,
      [scope.uid, kind, minutes, note]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO break_sessions (user_id, anon_id, kind, minutes, note) VALUES (NULL, $1, $2, $3, $4)
       RETURNING id, kind, minutes, note, started_at AS "startedAt"`,
      [scope.anonId, kind, minutes, note]
    ));
  }
  return NextResponse.json({ break: rows[0] }, { status: 201 });
}