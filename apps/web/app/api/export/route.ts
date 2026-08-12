import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

export async function GET() {
  const client = await pgPool.connect();
  try {
    const q = async (sql: string) => (await client.query(sql)).rows;
    const data = {
      app: "learn-workbench",
      schemaVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      progress: await q(`SELECT topic_id, done, note, updated_at FROM topic_progress WHERE user_id IS NULL`),
      tasks: await q(`SELECT task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order FROM daily_tasks WHERE user_id IS NULL`),
      sessions: await q(`SELECT task_id, started_at, ended_at, duration_seconds, tag FROM focus_sessions WHERE user_id IS NULL`),
      checkins: await q(`SELECT checkin_date, note FROM checkins WHERE user_id IS NULL`),
      logs: await q(`SELECT kind, title, content, created_at FROM log_entries WHERE user_id IS NULL`),
      certificates: await q(`SELECT name, target_date, status, note FROM certificates WHERE user_id IS NULL`),
    };
    return NextResponse.json(data);
  } finally {
    client.release();
  }
}
