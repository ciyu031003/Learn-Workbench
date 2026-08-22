import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { todayISO } from "@learn-workbench/shared";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISO();
  const scope = await userScope();
  const w1 = scopeWhere(scope, [scope.uid, date]);
  const { rows } = await pgPool.query(
    `SELECT id, amount_ml AS "amountMl", source, recorded_at AS "recordedAt"
     FROM hydration_logs
     WHERE user_id IS NOT DISTINCT FROM $1${w1.sql} AND deleted_at IS NULL
       AND recorded_at >= $2::date AND recorded_at < ($2::date + 1)
     ORDER BY recorded_at`,
    w1.params
  );
  const totalMl = rows.reduce((a: number, r: { amountMl: number }) => a + r.amountMl, 0);
  const w2 = scopeWhere(scope, [scope.uid, date]);
  const goal = await pgPool.query(
    `SELECT id, target_ml AS "targetMl" FROM hydration_goals
     WHERE user_id IS NOT DISTINCT FROM $1${w2.sql} AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    w2.params
  );
  return NextResponse.json({ logs: rows, totalMl, targetMl: goal.rows[0]?.targetMl ?? 2000 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const amountMl = Number(body?.amountMl);
  if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 2000) {
    return NextResponse.json({ error: "饮水量需在 1-2000 ml 之间" }, { status: 400 });
  }
  const source = ["MANUAL", "REMINDER", "FOCUS_BREAK"].includes(body?.source) ? String(body.source) : "MANUAL";
  const scope = await userScope();
  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO hydration_logs (user_id, amount_ml, source) VALUES ($1, $2, $3)
       RETURNING id, amount_ml AS "amountMl", source, recorded_at AS "recordedAt"`,
      [scope.uid, amountMl, source]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO hydration_logs (user_id, anon_id, amount_ml, source) VALUES (NULL, $1, $2, $3)
       RETURNING id, amount_ml AS "amountMl", source, recorded_at AS "recordedAt"`,
      [scope.anonId, amountMl, source]
    ));
  }
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}