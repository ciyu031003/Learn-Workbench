import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  const uid = await currentUserId();
  if (uid) {
    await pgPool.query(
      `INSERT INTO checkins (user_id, checkin_date, note) VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (user_id, checkin_date) WHERE user_id IS NOT NULL DO UPDATE SET note = EXCLUDED.note`,
      [uid, note]
    );
  } else {
    const anonId = await getAnonId();
    await pgPool.query(
      `INSERT INTO checkins (user_id, anon_id, checkin_date, note) VALUES (NULL, $1, CURRENT_DATE, $2)
       ON CONFLICT (anon_id, checkin_date) WHERE anon_id IS NOT NULL DO UPDATE SET note = EXCLUDED.note`,
      [anonId, note]
    );
  }
  return NextResponse.json({ ok: true });
}