import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "JSON 解析失败" }, { status: 400 });
  }
  if (data?.app !== "learn-workbench") {
    return NextResponse.json({ error: "不是有效的学习工作台备份文件" }, { status: 400 });
  }
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM topic_progress WHERE user_id IS NULL`);
    await client.query(`DELETE FROM daily_tasks WHERE user_id IS NULL`);
    await client.query(`DELETE FROM focus_sessions WHERE user_id IS NULL`);
    await client.query(`DELETE FROM checkins WHERE user_id IS NULL`);
    await client.query(`DELETE FROM log_entries WHERE user_id IS NULL`);
    await client.query(`DELETE FROM certificates WHERE user_id IS NULL`);
    await client.query(`DELETE FROM xp_events WHERE user_id IS NULL`);

    for (const p of Array.isArray(data.progress) ? data.progress : []) {
      await client.query(
        `INSERT INTO topic_progress (user_id, topic_id, done, note, updated_at) VALUES (NULL, $1, $2, $3, $4)
         ON CONFLICT (topic_id) WHERE user_id IS NULL DO UPDATE SET done = EXCLUDED.done, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
        [Number(p.topic_id), Boolean(p.done), p.note ?? null, p.updated_at ?? new Date().toISOString()]
      );
    }
    for (const t of Array.isArray(data.tasks) ? data.tasks : []) {
      await client.query(
        `INSERT INTO daily_tasks (user_id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)`,
        [t.task_date, String(t.title), t.phase_id ?? null, t.topic_id ?? null, t.task_type ?? "study", Boolean(t.done), Number(t.focus_minutes ?? 0), Number(t.sort_order ?? 0)]
      );
    }
    for (const s of Array.isArray(data.sessions) ? data.sessions : []) {
      await client.query(
        `INSERT INTO focus_sessions (user_id, task_id, started_at, ended_at, duration_seconds, tag) VALUES (NULL, $1, $2, $3, $4, $5)`,
        [s.task_id ?? null, s.started_at, s.ended_at ?? null, Number(s.duration_seconds ?? 0), s.tag ?? null]
      );
    }
    for (const c of Array.isArray(data.checkins) ? data.checkins : []) {
      await client.query(
        `INSERT INTO checkins (user_id, checkin_date, note) VALUES (NULL, $1, $2)
         ON CONFLICT (checkin_date) WHERE user_id IS NULL DO UPDATE SET note = EXCLUDED.note`,
        [c.checkin_date, c.note ?? null]
      );
    }
    for (const l of Array.isArray(data.logs) ? data.logs : []) {
      await client.query(
        `INSERT INTO log_entries (user_id, kind, title, content, created_at) VALUES (NULL, $1, $2, $3, $4)`,
        [l.kind, String(l.title), String(l.content), l.created_at ?? new Date().toISOString()]
      );
    }
    for (const c of Array.isArray(data.certificates) ? data.certificates : []) {
      await client.query(
        `INSERT INTO certificates (user_id, name, target_date, status, note) VALUES (NULL, $1, $2, $3, $4)`,
        [c.name, c.target_date ?? null, c.status ?? "planned", c.note ?? null]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("import error", e);
    return NextResponse.json({ error: "导入失败" }, { status: 500 });
  } finally {
    client.release();
  }
}

