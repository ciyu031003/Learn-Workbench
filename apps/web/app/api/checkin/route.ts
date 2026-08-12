import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  const uid = await currentUserId();
  await pgPool.query(
    `INSERT INTO checkins (user_id, checkin_date, note) VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (user_id, checkin_date) WHERE user_id IS NOT NULL DO UPDATE SET note = EXCLUDED.note`,
    [uid, note]
  );
  return NextResponse.json({ ok: true });
}
