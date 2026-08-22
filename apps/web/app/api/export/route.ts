import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";

export async function GET() {
  const client = await pgPool.connect();
  try {
    const uid = await currentUserId();
    const anonId = uid ? null : await getAnonId();
    const scopeParams: unknown[] = [uid];
    let scopeSql = "";
    if (!uid) {
      scopeParams.push(anonId);
      scopeSql = ` AND ${anonFilterSql(scopeParams.length)}`;
    }
    const q = async (sql: string, params: unknown[] = []) =>
      (await client.query(sql, params)).rows;
    const data = {
      app: "learn-workbench",
      schemaVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      progress: await q(`SELECT topic_id, done, note, updated_at FROM topic_progress WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
      tasks: await q(`SELECT task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order FROM daily_tasks WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
      sessions: await q(`SELECT task_id, started_at, ended_at, duration_seconds, tag FROM focus_sessions WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
      checkins: await q(`SELECT checkin_date, note FROM checkins WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
      logs: await q(`SELECT kind, title, content, created_at FROM log_entries WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
      certificates: await q(`SELECT name, target_date, status, note FROM certificates WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
      github: await q(`SELECT title, url, content FROM resume_assets WHERE user_id IS NOT DISTINCT FROM $1${scopeSql} AND kind = 'github'`, scopeParams),
    };
    return NextResponse.json(data);
  } finally {
    client.release();
  }
}