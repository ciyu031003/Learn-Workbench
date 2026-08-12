import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function GET() {
  const uid = await currentUserId();
  let career = "ict";
  if (uid) {
    const { rows } = await pgPool.query<{ value: unknown }>(
      `SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`,
      [uid]
    );
    if (rows[0]?.value) career = String(rows[0].value);
  }
  const { rows } = await pgPool.query<{ id: number; phase_key: string; title: string; track: string }>(
    `SELECT id, phase_key, title, track FROM content_phases
     WHERE career_key = $1 ORDER BY track, sort_order, id`,
    [career]
  );
  return NextResponse.json({ career, phases: rows });
}
