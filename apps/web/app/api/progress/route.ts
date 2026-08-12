import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const topicId = Number(body?.topicId);
  const done = Boolean(body?.done);
  const note = typeof body?.note === "string" ? body.note : null;
  if (!Number.isFinite(topicId)) {
    return NextResponse.json({ error: "topicId 无效" }, { status: 400 });
  }
  await pgPool.query(
    `INSERT INTO topic_progress (user_id, topic_id, done, note)
     VALUES (NULL, $1, $2, $3)
     ON CONFLICT (topic_id) WHERE user_id IS NULL
     DO UPDATE SET done = EXCLUDED.done, note = EXCLUDED.note, updated_at = now()`,
    [topicId, done, note]
  );
  return NextResponse.json({ ok: true });
}

