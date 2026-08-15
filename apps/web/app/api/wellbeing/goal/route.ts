import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { todayISO } from "@learn-workbench/shared";

export async function GET() {
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT id, target_ml AS "targetMl" FROM hydration_goals
     WHERE user_id IS NOT DISTINCT FROM $1 AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    [uid, todayISO()]
  );
  return NextResponse.json({ goal: rows[0] ?? { id: 0, targetMl: 2000 } });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const targetMl = Number(body?.targetMl);
  if (!Number.isFinite(targetMl) || targetMl < 200 || targetMl > 10000) {
    return NextResponse.json({ error: "目标需在 200-10000 ml 之间" }, { status: 400 });
  }
  const uid = await currentUserId();
  const today = todayISO();
  const existing = await pgPool.query(
    `SELECT id FROM hydration_goals WHERE user_id IS NOT DISTINCT FROM $1 AND effective_from = $2::date`,
    [uid, today]
  );
  let goal;
  if (existing.rows[0]) {
    const r = await pgPool.query(
      `UPDATE hydration_goals SET target_ml = $2, updated_at = now() WHERE id = $1 RETURNING id, target_ml AS "targetMl"`,
      [existing.rows[0].id, targetMl]
    );
    goal = r.rows[0];
  } else {
    const r = await pgPool.query(
      `INSERT INTO hydration_goals (user_id, target_ml, effective_from) VALUES ($1, $2, $3::date)
       RETURNING id, target_ml AS "targetMl"`,
      [uid, targetMl, today]
    );
    goal = r.rows[0];
  }
  return NextResponse.json({ goal });
}
