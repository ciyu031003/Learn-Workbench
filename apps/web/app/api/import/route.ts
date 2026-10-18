import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { buildExportPayload } from "@/lib/export-data";
import { resumeRootDir } from "@/lib/resume-files";
import { importFileSchema } from "@learn-workbench/shared";
import { logger } from "@/lib/logger";

/**
 * POST /api/import —— 导入备份（破坏性：先清空当前作用域数据再写入）。
 *
 * 2026-10-18 S1-4 加固（此前问题：未登录也能调用，且匿名请求会以 anon_id IS NULL 作用域
 * 清空「遗留匿名池」，与匿名隔离缺陷叠加等于任何人可清空匿名数据）：
 *  - 必须登录（uid 缺失直接 401）；
 *  - 必须显式确认（body.confirm === "OVERWRITE"），防误点；
 *  - 每用户 10 分钟最多 1 次（rateLimit）；
 *  - 事务内先落一份当前数据快照到 private/backups/，快照写失败则整体回滚（不毁数据）；
 *  - 成功后写审计日志。
 */
const IMPORT_CONFIRM = "OVERWRITE";

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) {
    return NextResponse.json({ error: "请先登录后再导入备份" }, { status: 401 });
  }

  const limited = await rateLimit(`import:${uid}`, { limit: 1, windowMs: 10 * 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "导入过于频繁，请稍后再试", retryAfter: limited.retryAfterSeconds },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, 1_000_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const raw = parsed.data as Record<string, unknown> | null;
  if (raw?.confirm !== IMPORT_CONFIRM) {
    return NextResponse.json(
      { error: "导入会清空当前离线数据，请传 confirm: \"OVERWRITE\" 以确认" },
      { status: 400 }
    );
  }

  const check = importFileSchema.safeParse(parsed.data);
  if (!check.success) {
    return NextResponse.json(
      { error: "备份文件格式不正确", detail: check.error.flatten() },
      { status: 400 }
    );
  }
  const data = check.data;

  const client = await pgPool.connect();
  let snapshotName: string | null = null;
  try {
    await client.query("BEGIN");

    // 先快照（同一事务内读当前状态），失败即整体回滚 —— 不允许"没有退路地清库"
    const snapshot = await buildExportPayload(client, { uid, anonId: null });
    const backupDir = path.join(resumeRootDir(), "backups");
    await mkdir(backupDir, { recursive: true });
    snapshotName = `import-${uid}-${Date.now()}.json`;
    await writeFile(path.join(backupDir, snapshotName), JSON.stringify(snapshot), "utf8");

    // 清空当前用户数据（uid 已保证非空，不再有匿名作用域分支）
    const scopeParams: unknown[] = [uid];
    for (const table of ["topic_progress","daily_tasks","focus_sessions","checkins","log_entries","certificates","resume_assets","xp_events","tracker_logs","domain_trackers"]) {
      await client.query(`DELETE FROM ${table} WHERE user_id IS NOT DISTINCT FROM $1`, scopeParams);
    }

    const stamp = (): { col: string; val: unknown } => ({ col: "user_id", val: uid });

    for (const p of data.progress) {
      const s = stamp();
      await client.query(
        `INSERT INTO topic_progress (${s.col}, topic_id, done, note, updated_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (${s.col}, topic_id) WHERE ${s.col} IS NOT NULL
         DO UPDATE SET done = EXCLUDED.done, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
        [s.val, Number(p.topic_id), Boolean(p.done), p.note ?? null, p.updated_at ?? new Date().toISOString()]
      );
    }
    for (const t of data.tasks) {
      const s = stamp();
      await client.query(
        `INSERT INTO daily_tasks (${s.col}, task_date, title, phase_id, topic_id, task_type, career_key, done, focus_minutes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [s.val, t.task_date, String(t.title), t.phase_id ?? null, t.topic_id ?? null, t.task_type ?? "study", t.career_key ?? "ict", Boolean(t.done), Number(t.focus_minutes ?? 0), Number(t.sort_order ?? 0)]
      );
    }
    for (const s of data.sessions) {
      const st = stamp();
      await client.query(
        `INSERT INTO focus_sessions (${st.col}, task_id, started_at, ended_at, duration_seconds, tag) VALUES ($1, $2, $3, $4, $5, $6)`,
        [st.val, s.task_id ?? null, s.started_at, s.ended_at ?? null, Number(s.duration_seconds ?? 0), s.tag ?? null]
      );
    }
    for (const c of data.checkins) {
      const st = stamp();
      await client.query(
        `INSERT INTO checkins (${st.col}, checkin_date, note) VALUES ($1, $2, $3)
         ON CONFLICT (${st.col}, checkin_date) WHERE ${st.col} IS NOT NULL DO UPDATE SET note = EXCLUDED.note`,
        [st.val, c.checkin_date, c.note ?? null]
      );
    }
    for (const l of data.logs) {
      const st = stamp();
      await client.query(
        `INSERT INTO log_entries (${st.col}, kind, career_key, title, content, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [st.val, l.kind, l.career_key ?? "ict", String(l.title), String(l.content), l.created_at ?? new Date().toISOString()]
      );
    }
    for (const c of data.certificates) {
      const st = stamp();
      await client.query(
        `INSERT INTO certificates (${st.col}, name, target_date, status, note) VALUES ($1, $2, $3, $4, $5)`,
        [st.val, c.name, c.target_date ?? null, c.status ?? "planned", c.note ?? null]
      );
    }
    for (const g of data.github) {
      const st = stamp();
      await client.query(
        `INSERT INTO resume_assets (${st.col}, kind, title, url, content) VALUES ($1, 'github', $2, $3, $4)`,
        [st.val, g.title, g.url ?? null, g.content ?? null]
      );
    }

    // 自定义领域：仅登录用户可导入（匿名不允许建私有域）
    for (const d of data.domains) {
      await client.query(
        `INSERT INTO careers (career_key, name, description, is_locked, owner_id, kind, icon, color, phase_prefix, is_archived)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (career_key) DO NOTHING`,
        [String(d.career_key), String(d.name), d.description ?? null, Boolean(d.is_locked ?? false), uid,
         d.kind ?? "custom", d.icon ?? "compass", d.color ?? "#6366f1", d.phase_prefix ?? "P", Boolean(d.is_archived ?? false)]
      );
    }
    const trackerIdByKey = new Map<string, number>();
    for (const t of data.trackers) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO domain_trackers (user_id, domain_key, name, unit, target_value, target_cadence, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, domain_key, name) DO UPDATE SET
           unit = EXCLUDED.unit, target_value = EXCLUDED.target_value,
           target_cadence = EXCLUDED.target_cadence, color = EXCLUDED.color,
           deleted_at = NULL, updated_at = now()
         RETURNING id`,
        [uid, String(t.domain_key), String(t.name), t.unit ?? "", t.target_value ?? null, t.target_cadence ?? null, t.color ?? "#6366f1"]
      );
      trackerIdByKey.set(`${t.domain_key}::${t.name}`, rows[0].id);
    }
    for (const l of data.tracker_logs) {
      const trackerId = trackerIdByKey.get(`${l.domain_key}::${l.tracker_name}`);
      if (trackerId == null) continue;
      await client.query(
        `INSERT INTO tracker_logs (user_id, tracker_id, log_date, value, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, tracker_id, log_date) DO UPDATE SET value = EXCLUDED.value, note = EXCLUDED.note, updated_at = now()`,
        [uid, trackerId, l.log_date, Number(l.value), l.note ?? null]
      );
    }

    await client.query("COMMIT");
    void writeAuditLog({
      action: "data.import",
      actorId: uid,
      actorType: "user",
      targetType: "user_data",
      targetId: uid,
      meta: { snapshot: snapshotName },
    });
    return NextResponse.json({ ok: true, snapshot: snapshotName });
  } catch (e) {
    await client.query("ROLLBACK");
    logger.error("import error", e);
    return NextResponse.json({ error: "导入失败" }, { status: 500 });
  } finally {
    client.release();
  }
}
