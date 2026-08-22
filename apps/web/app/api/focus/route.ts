import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const startedAt = new Date(String(body?.startedAt));
  const endedAt = body?.endedAt ? new Date(String(body.endedAt)) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: "startedAt 无效" }, { status: 400 });
  }
  const end = endedAt ?? new Date();
  const durationSeconds = Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000));
  const uid = await currentUserId();

  const client = await pgPool.connect();
  try {
    let rows;
    if (uid) {
      ({ rows } = await client.query(
        `INSERT INTO focus_sessions (user_id, task_id, started_at, ended_at, duration_seconds)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, task_id, started_at, ended_at, duration_seconds`,
        [uid, taskId, startedAt, endedAt, durationSeconds]
      ));
    } else {
      const anonId = await getAnonId();
      ({ rows } = await client.query(
        `INSERT INTO focus_sessions (user_id, anon_id, task_id, started_at, ended_at, duration_seconds)
         VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id, task_id, started_at, ended_at, duration_seconds`,
        [anonId, taskId, startedAt, endedAt, durationSeconds]
      ));
    }
    if (taskId && durationSeconds > 0 && uid) {
      await client.query(
        `UPDATE daily_tasks SET focus_minutes = focus_minutes + $1 WHERE id = $2 AND user_id IS NOT DISTINCT FROM $3`,
        [Math.round(durationSeconds / 60), taskId, uid]
      );
    }
    return NextResponse.json({ session: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}