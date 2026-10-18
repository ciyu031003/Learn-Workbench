import type { PoolClient } from "pg";
import { anonFilterSql } from "./anon";

/**
 * 备份导出载荷（/api/export 与 /api/import 的导入前快照共用）。
 *
 * 2026-10-18：从 app/api/export/route.ts 抽出来。导入是「先清空再写入」的破坏性操作，
 * 必须在同一事务内先落一份当前数据快照（S1-4），否则误操作不可恢复。
 */
export interface ExportScope {
  uid: string | null;
  anonId: string | null;
}

export async function buildExportPayload(
  client: PoolClient,
  scope: ExportScope
): Promise<Record<string, unknown>> {
  const { uid, anonId } = scope;
  const scopeParams: unknown[] = [uid];
  let scopeSql = "";
  if (!uid) {
    scopeParams.push(anonId);
    scopeSql = ` AND ${anonFilterSql(scopeParams.length)}`;
  }
  const q = async (sql: string, params: unknown[] = []) =>
    (await client.query(sql, params)).rows;

  return {
    app: "learn-workbench",
    schemaVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    progress: await q(`SELECT topic_id, done, note, updated_at FROM topic_progress WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
    tasks: await q(`SELECT task_date, title, phase_id, topic_id, task_type, career_key, done, focus_minutes, sort_order FROM daily_tasks WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
    sessions: await q(`SELECT task_id, started_at, ended_at, duration_seconds, tag FROM focus_sessions WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
    checkins: await q(`SELECT checkin_date, note FROM checkins WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
    logs: await q(`SELECT kind, career_key, title, content, created_at FROM log_entries WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
    certificates: await q(`SELECT name, target_date, status, note FROM certificates WHERE user_id IS NOT DISTINCT FROM $1${scopeSql}`, scopeParams),
    github: await q(`SELECT title, url, content FROM resume_assets WHERE user_id IS NOT DISTINCT FROM $1${scopeSql} AND kind = 'github'`, scopeParams),
    // 领域与记录维度：仅导出当前用户自建域（系统内置域全员共享，不属于个人备份）
    domains: uid
      ? await q(`SELECT career_key, name, description, is_locked, owner_id, kind, icon, color, phase_prefix, is_archived FROM careers WHERE owner_id = $1`, [uid])
      : [],
    trackers: await q(`SELECT domain_key, name, unit, target_value, target_cadence, color FROM domain_trackers WHERE user_id IS NOT DISTINCT FROM $1${scopeSql} AND deleted_at IS NULL`, scopeParams),
    tracker_logs: await q(
      `SELECT t.domain_key, t.name AS tracker_name, l.log_date, l.value, l.note
         FROM tracker_logs l JOIN domain_trackers t ON t.id = l.tracker_id
         WHERE l.user_id IS NOT DISTINCT FROM $1${scopeSql}`,
      scopeParams
    ),
  };
}
