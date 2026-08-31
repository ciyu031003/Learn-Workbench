import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { todayISO, exerciseTypeSchema } from "@learn-workbench/shared";

const SOURCES = ["MANUAL", "FOCUS", "BREAK"];

function pickType(raw: unknown): string {
  const v = String(raw ?? "");
  return exerciseTypeSchema.safeParse(v).success ? v : "OTHER";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISO();
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, date]);
  const { rows } = await pgPool.query(
    `SELECT id, type, type_label AS "typeLabel", duration_seconds AS "durationSeconds",
            source, note, started_at AS "startedAt"
     FROM exercise_logs
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)
     ORDER BY started_at`,
    w.params
  );
  const totalSeconds = rows.reduce((a: number, r: { durationSeconds: number }) => a + r.durationSeconds, 0);

  // 当日目标
  const gw = scopeWhere(scope, [scope.uid, date]);
  const goal = await pgPool.query(
    `SELECT id, target_minutes AS "targetMinutes" FROM exercise_goals
     WHERE user_id IS NOT DISTINCT FROM $1${gw.sql} AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    gw.params
  );
  const targetMinutes = goal.rows[0]?.targetMinutes ?? 30;
  return NextResponse.json({
    date,
    logs: rows,
    totalMinutes: Math.round(totalSeconds / 60),
    totalSeconds,
    targetMinutes,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const type = pickType(body?.type);
  const typeLabel = typeof body?.typeLabel === "string" ? body.typeLabel.trim().slice(0, 50) || null : null;
  const durationSeconds = Math.min(86400, Math.max(0, Math.round(Number(body?.durationSeconds) || 0)));
  const source = SOURCES.includes(body?.source) ? String(body.source) : "MANUAL";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  const startedAt = typeof body?.startedAt === "string" && !Number.isNaN(Date.parse(body.startedAt))
    ? new Date(body.startedAt)
    : new Date();

  const scope = await userScope();
  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO exercise_logs (user_id, type, type_label, duration_seconds, source, note, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, type_label AS "typeLabel", duration_seconds AS "durationSeconds", source, note, started_at AS "startedAt"`,
      [scope.uid, type, typeLabel, durationSeconds, source, note, startedAt]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO exercise_logs (user_id, anon_id, type, type_label, duration_seconds, source, note, started_at)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, type_label AS "typeLabel", duration_seconds AS "durationSeconds", source, note, started_at AS "startedAt"`,
      [scope.anonId, type, typeLabel, durationSeconds, source, note, startedAt]
    ));
  }
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE exercise_logs SET deleted_at = now() WHERE id = $2 AND user_id IS NOT DISTINCT FROM $1${w.sql}`,
    w.params
  );
  return NextResponse.json({ ok: true });
}