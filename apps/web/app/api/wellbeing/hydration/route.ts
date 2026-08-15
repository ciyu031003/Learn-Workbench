import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { todayISO } from "@learn-workbench/shared";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISO();
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT id, amount_ml AS "amountMl", source, recorded_at AS "recordedAt"
     FROM hydration_logs
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL
       AND recorded_at >= $2::date AND recorded_at < ($2::date + 1)
     ORDER BY recorded_at`,
    [uid, date]
  );
  const totalMl = rows.reduce((a: number, r: { amountMl: number }) => a + r.amountMl, 0);
  const goal = await pgPool.query(
    `SELECT id, target_ml AS "targetMl" FROM hydration_goals
     WHERE user_id IS NOT DISTINCT FROM $1 AND effective_from <= $2::date
     ORDER BY effective_from DESC LIMIT 1`,
    [uid, date]
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
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `INSERT INTO hydration_logs (user_id, amount_ml, source) VALUES ($1, $2, $3)
     RETURNING id, amount_ml AS "amountMl", source, recorded_at AS "recordedAt"`,
    [uid, amountMl, source]
  );
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}
