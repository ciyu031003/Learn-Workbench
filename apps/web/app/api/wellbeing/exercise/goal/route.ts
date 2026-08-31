import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { todayISO } from "@learn-workbench/shared";

export async function GET() {
  const scope = await userScope();
  const date = todayISO();
  const w = scopeWhere(scope, [scope.uid, date]);
  const { rows } = await pgPool.query(
    `SELECT id, target_minutes AS "targetMinutes" FROM exercise_goals
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    w.params
  );
  return NextResponse.json({ targetMinutes: rows[0]?.targetMinutes ?? 30 });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const targetMinutes = Number(body?.targetMinutes);
  if (!Number.isFinite(targetMinutes) || targetMinutes < 1 || targetMinutes > 600) {
    return NextResponse.json({ error: "目标需在 1-600 分钟之间" }, { status: 400 });
  }
  const scope = await userScope();
  const date = todayISO();

  // 幂等：当天已有目标则更新，否则新增
  const w = scopeWhere(scope, [scope.uid, date]);
  const existing = await pgPool.query(
    `SELECT id FROM exercise_goals
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND effective_from = $2::date
     ORDER BY id DESC LIMIT 1`,
    w.params
  );
  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    const { rows } = await pgPool.query(
      `UPDATE exercise_goals SET target_minutes = $2, updated_at = now() WHERE id = $1
       RETURNING id, target_minutes AS "targetMinutes"`,
      [id, targetMinutes]
    );
    return NextResponse.json({ goal: rows[0] });
  }

  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO exercise_goals (user_id, target_minutes, effective_from) VALUES ($1, $2, $3::date)
       RETURNING id, target_minutes AS "targetMinutes"`,
      [scope.uid, targetMinutes, date]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO exercise_goals (user_id, anon_id, target_minutes, effective_from) VALUES (NULL, $1, $2, $3::date)
       RETURNING id, target_minutes AS "targetMinutes"`,
      [scope.anonId, targetMinutes, date]
    ));
  }
  return NextResponse.json({ goal: rows[0] }, { status: 201 });
}