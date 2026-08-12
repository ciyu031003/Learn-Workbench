import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const startedAt = new Date(String(body?.startedAt));
  const endedAt = body?.endedAt ? new Date(String(body.endedAt)) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: "startedAt 无效" }, { status: 400 });
  }
  const end = endedAt ?? new Date();
  const durationSeconds = Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000));

  const client = await pgPool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO focus_sessions (user_id, task_id, started_at, ended_at, duration_seconds)
       VALUES (NULL, $1, $2, $3, $4) RETURNING id, task_id, started_at, ended_at, duration_seconds`,
      [taskId, startedAt, endedAt, durationSeconds]
    );
    if (taskId && durationSeconds > 0) {
      await client.query(
        `UPDATE daily_tasks SET focus_minutes = focus_minutes + $1 WHERE id = $2`,
        [Math.round(durationSeconds / 60), taskId]
      );
    }
    return NextResponse.json({ session: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
