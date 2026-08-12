import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const data = await req.json().catch(() => null);
  if (!data) return NextResponse.json({ error: "JSON 解析失败" }, { status: 400 });

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    // 全量替换（以最后同步的设备为准）
    for (const table of ["topic_progress","daily_tasks","focus_sessions","checkins","log_entries","certificates","resume_assets","xp_events"]) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [uid]);
    }
    await client.query(`DELETE FROM content_topics WHERE owner_id = $1 AND is_custom = TRUE`, [uid]);

    for (const p of Array.isArray(data.progress) ? data.progress : []) {
      await client.query(
        `INSERT INTO topic_progress (user_id, topic_id, done, note, updated_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, topic_id) WHERE user_id IS NOT NULL DO UPDATE SET done = EXCLUDED.done, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
        [uid, Number(p.topicId), Boolean(p.done), p.note ?? null, p.updatedAt ?? new Date().toISOString()]
      );
    }
    for (const t of Array.isArray(data.tasks) ? data.tasks : []) {
      await client.query(
        `INSERT INTO daily_tasks (user_id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uid, t.taskDate, String(t.title), t.phaseId ?? null, t.topicId ?? null, t.taskType ?? "study", Boolean(t.done), Number(t.focusMinutes ?? 0), Number(t.sortOrder ?? 0)]
      );
    }
    for (const s of Array.isArray(data.sessions) ? data.sessions : []) {
      await client.query(
        `INSERT INTO focus_sessions (user_id, task_id, started_at, ended_at, duration_seconds, tag) VALUES ($1, $2, $3, $4, $5, $6)`,
        [uid, s.taskId ?? null, s.startedAt, s.endedAt ?? null, Number(s.durationSeconds ?? 0), s.tag ?? null]
      );
    }
    for (const c of Array.isArray(data.checkins) ? data.checkins : []) {
      await client.query(
        `INSERT INTO checkins (user_id, checkin_date, note) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, checkin_date) WHERE user_id IS NOT NULL DO UPDATE SET note = EXCLUDED.note`,
        [uid, c.checkinDate, c.note ?? null]
      );
    }
    for (const l of Array.isArray(data.logs) ? data.logs : []) {
      await client.query(
        `INSERT INTO log_entries (user_id, kind, title, content, created_at) VALUES ($1, $2, $3, $4, $5)`,
        [uid, l.kind, String(l.title), String(l.content), l.createdAt ?? new Date().toISOString()]
      );
    }
    for (const c of Array.isArray(data.certificates) ? data.certificates : []) {
      await client.query(
        `INSERT INTO certificates (user_id, name, target_date, status, note) VALUES ($1, $2, $3, $4, $5)`,
        [uid, c.name, c.targetDate ?? null, c.status ?? "planned", c.note ?? null]
      );
    }
    for (const g of Array.isArray(data.github) ? data.github : []) {
      await client.query(
        `INSERT INTO resume_assets (user_id, kind, title, url, content) VALUES ($1, 'github', $2, $3, $4)`,
        [uid, String(g.title), g.url ?? null, g.content ?? null]
      );
    }
    for (const ct of Array.isArray(data.customTopics) ? data.customTopics : []) {
      const phaseId = Number(ct.phaseId);
      if (!Number.isFinite(phaseId)) continue;
      await client.query(
        `INSERT INTO content_topics (phase_id, topic_key, title, summary, sort_order, is_custom, owner_id)
         VALUES ($1, 'custom-' || gen_random_uuid(), $2, $3,
                 (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM content_topics WHERE phase_id = $1), TRUE, $4)`,
        [phaseId, String(ct.title), ct.summary ?? null, uid]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("sync push error", e);
    return NextResponse.json({ error: "同步失败" }, { status: 500 });
  } finally {
    client.release();
  }
}
