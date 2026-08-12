import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const client = await pgPool.connect();
  try {
    const q = async (sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows;
    const data = {
      progress: await q(`SELECT topic_id AS "topicId", done, note, updated_at AS "updatedAt" FROM topic_progress WHERE user_id = $1`, [uid]),
      tasks: await q(`SELECT id, task_date AS "taskDate", title, phase_id AS "phaseId", topic_id AS "topicId", task_type AS "taskType", done, focus_minutes AS "focusMinutes", sort_order AS "sortOrder" FROM daily_tasks WHERE user_id = $1`, [uid]),
      sessions: await q(`SELECT id, task_id AS "taskId", started_at AS "startedAt", ended_at AS "endedAt", duration_seconds AS "durationSeconds", tag FROM focus_sessions WHERE user_id = $1`, [uid]),
      checkins: await q(`SELECT checkin_date AS "checkinDate", note FROM checkins WHERE user_id = $1`, [uid]),
      logs: await q(`SELECT id, kind, title, content, created_at AS "createdAt" FROM log_entries WHERE user_id = $1`, [uid]),
      certificates: await q(`SELECT id, name, target_date AS "targetDate", status, note FROM certificates WHERE user_id = $1`, [uid]),
      github: await q(`SELECT id, title, url, content FROM resume_assets WHERE user_id = $1 AND kind = 'github'`, [uid]),
      customTopics: await q(
        `SELECT id, phase_id AS "phaseId", title, summary FROM content_topics WHERE owner_id = $1 AND is_custom = TRUE ORDER BY id`,
        [uid]
      ),
    };
    return NextResponse.json(data);
  } finally {
    client.release();
  }
}
