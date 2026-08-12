import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  await pgPool.query(
    `INSERT INTO checkins (user_id, checkin_date, note) VALUES (NULL, CURRENT_DATE, $1)
     ON CONFLICT (checkin_date) WHERE user_id IS NULL DO UPDATE SET note = EXCLUDED.note`,
    [note]
  );
  return NextResponse.json({ ok: true });
}
