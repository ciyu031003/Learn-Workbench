import type { PoolClient } from "pg";
import { logger } from "@/lib/logger";
import { exerciseTypeSchema } from "@learn-workbench/shared";
import {
  SYNC_ENTITY_TYPES,
  SYNC_RECEIPT_REASONS,
  type SyncEntityType,
  type SyncReceiptResult,
} from "@learn-workbench/shared/sync";

// ============================================================================
// 增量同步核心（方案 §37-§40）
// - 实体统一带 updated_at / deleted_at（软删除）
// - 代理键实体带 client_id（跨设备稳定 ID）
// - 冲突策略：Last-Write-Wins（按 updated_at）
// - push：applyChanges；pull：collectChangesSince
// ============================================================================

export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";

export interface SyncChange {
  /** S5-2：实体白名单来自 shared/sync（双端单一事实源） */
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  version: number;
  payload: Record<string, unknown> | null;
  updatedAt: string;
  /** 幂等键（B5）：客户端生成的稳定 ID，重试推送按 (user_id, change_id) 去重 */
  changeId?: string;
}

// 白名单单一事实源在 packages/shared/src/sync.ts；此处 re-export 供 web 侧与测试沿用旧导入路径
export { SYNC_ENTITY_TYPES };

/**
 * 同步服务端时间（v2 游标唯一可信来源）：
 * 以 Asia/Shanghai（UTC+8）ISO-8601 返回，例如 `2026-08-13T18:00:00.000+08:00`。
 *
 * 为什么不用 `toISOString()`：客户端把 serverTime 当游标回传，`+08:00` 与 `Z` 表示同一瞬间，
 * 但产品/排障口径统一按北京时间，日志、看板、SQL 对照时不用再做时区心算。
 * 中国无夏令时，固定 +08:00 安全。
 */
export const SYNC_SERVER_TIMEZONE = "Asia/Shanghai";

export function serverTimeISO(date: Date | string = new Date()): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const ms = value.getTime();
  const safe = Number.isNaN(ms) ? Date.now() : ms;
  return new Date(safe + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00");
}

/** 逐条回执（push 响应 receipts[] 的服务端内部形态，seq 由 recordSyncChanges 回填） */
export interface SyncApplyReceipt {
  changeId: string | null;
  /** 该变更在请求 changes[] 中的下标（0-based） */
  index: number;
  result: SyncReceiptResult;
  reason: string;
  /** 服务端单调序号；rejected 时为 null（stale-duplicate 为既有行 seq） */
  seq: number | null;
  /** applied 时指向 okChanges 的下标（路由据此回填 seq）；其余为 null */
  recordIndex: number | null;
}

function atOf(c: SyncChange): Date {
  const d = new Date(c.updatedAt);
  const t = isNaN(d.getTime()) ? Date.now() : d.getTime();
  // 钳制未来时间戳：客户端时钟漂移/恶意超前会污染 LWW 排序（远端新数据被判"更旧"而丢失）
  const maxT = Date.now() + 5 * 60_000;
  return new Date(Math.min(t, maxT));
}

function newer(a: Date | null | undefined, b: Date): boolean {
  return !!a && a.getTime() > b.getTime();
}

// ---------------- progress (topic_progress, natural key: topic_id) ----------------
async function applyProgress(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const topicId = Number(c.entityId);
  if (!Number.isFinite(topicId)) return false;
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE topic_progress SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND topic_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, topicId, at]
    );
    return true;
  }
  const p = (c.payload ?? {}) as { done?: boolean; note?: string | null };
  const { rows } = await client.query(
    `SELECT updated_at, deleted_at FROM topic_progress WHERE user_id = $1 AND topic_id = $2`,
    [uid, topicId]
  );
  if (rows[0] && newer(rows[0].deleted_at, at)) return true;
  if (rows[0] && !rows[0].deleted_at && newer(rows[0].updated_at, at)) return true;
  await client.query(
    `INSERT INTO topic_progress (user_id, topic_id, done, note, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, NULL)
     ON CONFLICT (user_id, topic_id) WHERE user_id IS NOT NULL
     DO UPDATE SET done = EXCLUDED.done, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [uid, topicId, Boolean(p.done), p.note ?? null, at]
  );
  return true;
}

// ---------------- tasks (daily_tasks, key: client_id) ----------------
async function applyTasks(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM daily_tasks WHERE user_id = $1 AND client_id = $2`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE daily_tasks SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND client_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  await client.query(
    `INSERT INTO daily_tasks
       (user_id, client_id, task_date, title, phase_id, topic_id, task_type, career_key, done, focus_minutes, sort_order, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL)
     ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET task_date = EXCLUDED.task_date, title = EXCLUDED.title, phase_id = EXCLUDED.phase_id,
       topic_id = EXCLUDED.topic_id, task_type = EXCLUDED.task_type, career_key = EXCLUDED.career_key,
       done = EXCLUDED.done, focus_minutes = EXCLUDED.focus_minutes, sort_order = EXCLUDED.sort_order,
       updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [
      uid, clientId, p.taskDate ?? null, String(p.title ?? ""),
      p.phaseId ?? null, p.topicId ?? null, p.taskType ?? "study",
      String(p.careerKey ?? "ict"),
      Boolean(p.done), Number(p.focusMinutes ?? 0), Number(p.sortOrder ?? 0), at,
    ]
  );
  return true;
}

// ---------------- sessions (focus_sessions, key: client_id) ----------------
async function applySessions(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM focus_sessions WHERE user_id = $1 AND client_id = $2`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE focus_sessions SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND client_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  await client.query(
    `INSERT INTO focus_sessions
       (user_id, client_id, task_id, started_at, ended_at, duration_seconds, tag, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
     ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET task_id = EXCLUDED.task_id, started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at,
       duration_seconds = EXCLUDED.duration_seconds, tag = EXCLUDED.tag,
       updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [uid, clientId, p.taskId ?? null, p.startedAt ?? at, p.endedAt ?? null, Number(p.durationSeconds ?? 0), p.tag ?? null, at]
  );
  return true;
}

// ---------------- checkins (checkins, natural key: checkin_date) ----------------
async function applyCheckins(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const date = c.entityId;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { rows } = await client.query(
    `SELECT updated_at, deleted_at FROM checkins WHERE user_id = $1 AND checkin_date = $2`,
    [uid, date]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE checkins SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND checkin_date = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, date, at]
    );
    return true;
  }
  if (rows[0] && newer(rows[0].deleted_at, at)) return true;
  if (rows[0] && !rows[0].deleted_at && newer(rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as { note?: string | null };
  await client.query(
    `INSERT INTO checkins (user_id, checkin_date, note, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, NULL)
     ON CONFLICT (user_id, checkin_date) WHERE user_id IS NOT NULL
     DO UPDATE SET note = EXCLUDED.note, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [uid, date, p.note ?? null, at]
  );
  return true;
}

// ---------------- logs (log_entries, key: client_id) ----------------
async function applyLogs(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM log_entries WHERE user_id = $1 AND client_id = $2`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE log_entries SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND client_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  await client.query(
    `INSERT INTO log_entries (user_id, client_id, kind, career_key, title, content, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
     ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET kind = EXCLUDED.kind, career_key = EXCLUDED.career_key, title = EXCLUDED.title, content = EXCLUDED.content,
       created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [uid, clientId, p.kind ?? "review", String(p.careerKey ?? "ict"), String(p.title ?? ""), String(p.content ?? ""), p.createdAt ?? at, at]
  );
  return true;
}

// ---------------- github (resume_assets kind='github', key: client_id) ----------------
async function applyGithub(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM resume_assets WHERE user_id = $1 AND client_id = $2 AND kind = 'github'`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE resume_assets SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND client_id = $2 AND kind = 'github' AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  await client.query(
    `INSERT INTO resume_assets (user_id, client_id, kind, title, url, content, updated_at, deleted_at)
     VALUES ($1, $2, 'github', $3, $4, $5, $6, NULL)
     ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, content = EXCLUDED.content,
       updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [uid, clientId, String(p.title ?? ""), p.url ?? null, p.content ?? null, at]
  );
  return true;
}

// ---------------- customTopics (content_topics, key: client_id, owner_id) ----------------
async function applyCustomTopics(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM content_topics WHERE owner_id = $1 AND client_id = $2`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE content_topics SET deleted_at = $3, updated_at = $3
       WHERE owner_id = $1 AND client_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  await client.query(
    `INSERT INTO content_topics
       (phase_id, topic_key, title, summary, sort_order, is_custom, owner_id, client_id, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8, NULL)
     ON CONFLICT (owner_id, client_id) WHERE owner_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET phase_id = EXCLUDED.phase_id, title = EXCLUDED.title, summary = EXCLUDED.summary,
       sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [
      Number(p.phaseId), "custom-" + clientId.slice(0, 12), String(p.title ?? ""),
      p.summary ?? null, Number(p.sortOrder ?? 0), uid, clientId, at,
    ]
  );
  return true;
}

// ---------------- exerciseLogs (exercise_logs, key: client_id) ----------------
// 移动端运动记录入库：type 走枚举校验（非法回退 OTHER），source 仅允许 MANUAL/FOCUS/BREAK
async function applyExerciseLogs(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM exercise_logs WHERE user_id = $1 AND client_id = $2`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE exercise_logs SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND client_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  const type = exerciseTypeSchema.safeParse(p.type).success ? String(p.type) : "OTHER";
  const source = ["MANUAL", "FOCUS", "BREAK"].includes(String(p.source)) ? String(p.source) : "MANUAL";
  const durationSeconds = Math.min(86400, Math.max(0, Math.round(Number(p.durationSeconds) || 0)));
  const typeLabel = typeof p.typeLabel === "string" ? p.typeLabel.trim().slice(0, 50) || null : null;
  const note = typeof p.note === "string" ? p.note.trim().slice(0, 200) || null : null;
  const startedAt = typeof p.startedAt === "string" && !Number.isNaN(Date.parse(p.startedAt))
    ? new Date(p.startedAt)
    : at;
  await client.query(
    `INSERT INTO exercise_logs
       (user_id, client_id, type, type_label, duration_seconds, source, note, started_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
     ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET type = EXCLUDED.type, type_label = EXCLUDED.type_label,
       duration_seconds = EXCLUDED.duration_seconds, source = EXCLUDED.source, note = EXCLUDED.note,
       started_at = EXCLUDED.started_at, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [uid, clientId, type, typeLabel, durationSeconds, source, note, startedAt, at]
  );
  return true;
}

// ---------------- certificates (certificates, key: client_id) ----------------
// 移动端证书入库：status 走枚举校验（非法回退 planned），日期仅接受 YYYY-MM-DD。
const CERT_STATUSES = ["planned", "preparing", "achieved"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function pickDateOnly(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 10);
  return DATE_RE.test(s) ? s : null;
}

async function applyCertificates(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM certificates WHERE user_id = $1 AND client_id = $2`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE certificates SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND client_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name.trim().slice(0, 200) : "";
  if (!name) return false;
  const status = CERT_STATUSES.includes(String(p.status)) ? String(p.status) : "planned";
  const issuer = typeof p.issuer === "string" ? p.issuer.trim().slice(0, 200) || null : null;
  const imageUrl = typeof p.imageUrl === "string" ? p.imageUrl.trim().slice(0, 2000) || null : null;
  const note = typeof p.note === "string" ? p.note.trim().slice(0, 5000) || null : null;
  const sortOrder = Math.max(0, Math.min(10000, Math.round(Number(p.sortOrder) || 0)));
  await client.query(
    `INSERT INTO certificates
       (user_id, client_id, name, issuer, status, target_date, earned_date, expiry_date, image_url, sort_order, note, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL)
     ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET name = EXCLUDED.name, issuer = EXCLUDED.issuer, status = EXCLUDED.status,
       target_date = EXCLUDED.target_date, earned_date = EXCLUDED.earned_date, expiry_date = EXCLUDED.expiry_date,
       image_url = EXCLUDED.image_url, sort_order = EXCLUDED.sort_order, note = EXCLUDED.note,
       updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [
      uid, clientId, name, issuer, status,
      pickDateOnly(p.targetDate), pickDateOnly(p.earnedDate), pickDateOnly(p.expiryDate),
      imageUrl, sortOrder, note, at,
    ]
  );
  return true;
}

// ---------------- habits (habits, key: client_id) ----------------
async function applyHabits(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const clientId = c.entityId;
  if (!clientId) return false;
  const existing = await client.query(
    `SELECT id, updated_at, deleted_at FROM habits WHERE user_id = $1 AND client_id = $2`,
    [uid, clientId]
  );
  if (c.operation === "DELETE") {
    await client.query(
      `UPDATE habits SET deleted_at = $3, updated_at = $3
       WHERE user_id = $1 AND client_id = $2 AND (deleted_at IS NULL OR deleted_at <= $3) AND updated_at <= $3`,
      [uid, clientId, at]
    );
    return true;
  }
  if (existing.rows[0] && newer(existing.rows[0].deleted_at, at)) return true;
  if (existing.rows[0] && !existing.rows[0].deleted_at && newer(existing.rows[0].updated_at, at)) return true;
  const p = (c.payload ?? {}) as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name.trim().slice(0, 60) : "";
  if (!name) return false;
  const isBoolean = p.isBoolean === undefined ? true : Boolean(p.isBoolean);
  const rawTarget = Number(p.targetValue);
  const targetValue = isBoolean || !Number.isFinite(rawTarget) || rawTarget <= 0 ? null : Math.min(1_000_000, rawTarget);
  const unit = typeof p.unit === "string" ? p.unit.trim().slice(0, 20) || null : null;
  const icon = typeof p.icon === "string" ? p.icon.trim().slice(0, 20) || null : null;
  const color = typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#6366f1";
  const schedule = Array.isArray(p.schedule)
    ? [...new Set(p.schedule.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
    : [0, 1, 2, 3, 4, 5, 6];
  const sortOrder = Math.max(0, Math.min(10000, Math.round(Number(p.sortOrder) || 0)));
  await client.query(
    `INSERT INTO habits
       (user_id, client_id, name, icon, is_boolean, target_value, unit, schedule, color, sort_order, updated_at, deleted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL)
     ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
     DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, is_boolean = EXCLUDED.is_boolean,
       target_value = EXCLUDED.target_value, unit = EXCLUDED.unit, schedule = EXCLUDED.schedule,
       color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
    [
      uid, clientId, name, icon, isBoolean, targetValue, unit,
      schedule.length > 0 ? schedule : [0, 1, 2, 3, 4, 5, 6], color, sortOrder, at,
    ]
  );
  return true;
}

// ---------------- habitLogs (habit_logs, key: `<habitClientId>|<YYYY-MM-DD>`) ----------------
async function applyHabitLogs(client: PoolClient, uid: string, c: SyncChange, at: Date): Promise<boolean> {
  const [habitClientId, dateRaw] = String(c.entityId ?? "").split("|");
  if (!habitClientId || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw ?? "")) return false;
  const date = dateRaw;
  const { rows: habitRows } = await client.query(
    `SELECT id FROM habits WHERE user_id = $1 AND client_id = $2`,
    [uid, habitClientId]
  );
  const habitId = habitRows[0]?.id;
  if (!habitId) return false;

  if (c.operation === "DELETE") {
    await client.query(
      `DELETE FROM habit_logs WHERE user_id = $1 AND habit_id = $2 AND log_date = $3::date`,
      [uid, habitId, date]
    );
    return true;
  }
  const p = (c.payload ?? {}) as Record<string, unknown>;
  const valueRaw = Number(p.value);
  const value = Number.isFinite(valueRaw) && valueRaw >= 0 ? Math.min(1_000_000, valueRaw) : 1;
  const note = typeof p.note === "string" ? p.note.trim().slice(0, 500) || null : null;
  await client.query(
    `INSERT INTO habit_logs (user_id, habit_id, log_date, value, note, updated_at)
     VALUES ($1, $2, $3::date, $4, $5, $6)
     ON CONFLICT (user_id, habit_id, log_date)
     DO UPDATE SET value = EXCLUDED.value, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
    [uid, habitId, date, value, note, at]
  );
  return true;
}

const APPLIERS: Record<string, (client: PoolClient, uid: string, c: SyncChange, at: Date) => Promise<boolean>> = {
  progress: applyProgress,
  tasks: applyTasks,
  sessions: applySessions,
  checkins: applyCheckins,
  logs: applyLogs,
  github: applyGithub,
  customTopics: applyCustomTopics,
  exerciseLogs: applyExerciseLogs,
  certificates: applyCertificates,
  habits: applyHabits,
  habitLogs: applyHabitLogs,
};

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/** 设备标识白名单校验（push/pull 共用，防伪造超长脏数据写入 sync_devices） */
export function sanitizeDeviceId(raw: string, fallback: string): string {
  return DEVICE_ID_RE.test(raw) ? raw : fallback;
}

/** 设备名截断（push/pull 共用） */
export function sanitizeDeviceName(raw: string | null | undefined): string | null {
  return typeof raw === "string" ? raw.slice(0, 50) : null;
}

/**
 * 逐条应用变更并产出**逐条回执**（S5-2）。
 *
 * 回执语义（结果判定完全集中在服务端，客户端不用猜）：
 *  - `applied`：applier 成功执行（**注意**：applier 目前返回 boolean，LWW 下"本地更新、未覆盖"
 *    也返回 true —— 这类变更同样计入 applied，是已知取舍：为它改 11 个 applier 的签名收益低、
 *    回归面大；客户端只需按 applied 清除本地队列，LWW 语义仍由服务端负责）；
 *  - `stale` + reason=duplicate：changeId 已在 sync_changes（客户端重试），不重复应用；
 *  - `rejected` + reason=unknown_entity_type / invalid_entity_id / apply_failed：本条未生效，
 *    不影响同批其它条（applier 异常被捕获，不会回滚整批）。
 *
 * seq 由 `recordSyncChanges`（RETURNING seq）回填，本函数只给 recordIndex 指针。
 */
export async function applyChanges(
  client: PoolClient, uid: string, changes: SyncChange[]
): Promise<{ applied: number; okChanges: SyncChange[]; receipts: SyncApplyReceipt[] }> {
  let applied = 0;
  const okChanges: SyncChange[] = [];
  const receipts: SyncApplyReceipt[] = [];
  for (const [index, c] of changes.entries()) {
    const fn = APPLIERS[c.entityType];
    const changeId = typeof c.changeId === "string" && c.changeId.length > 0 ? c.changeId : null;
    if (!fn) {
      receipts.push({
        changeId, index, result: "rejected",
        reason: SYNC_RECEIPT_REASONS.unknownEntityType, seq: null, recordIndex: null,
      });
      continue;
    }
    // B5 幂等：该 changeId 已应用过（客户端重试）→ stale(duplicate)，回执带上原 seq 便于客户端对齐
    if (changeId) {
      const { rows } = await client.query(
        `SELECT seq FROM sync_changes WHERE user_id = $1 AND change_id = $2`,
        [uid, changeId]
      );
      if (rows.length > 0) {
        const rawSeq = (rows[0] as { seq?: unknown } | undefined)?.seq;
        const seq = rawSeq === null || rawSeq === undefined || !Number.isFinite(Number(rawSeq)) ? null : Number(rawSeq);
        receipts.push({
          changeId, index, result: "stale",
          reason: SYNC_RECEIPT_REASONS.duplicate, seq, recordIndex: null,
        });
        continue;
      }
    }
    try {
      const ok = await fn(client, uid, c, atOf(c));
      if (ok) {
        const recordIndex = okChanges.length;
        okChanges.push(c);
        applied++;
        receipts.push({
          changeId, index, result: "applied",
          reason: SYNC_RECEIPT_REASONS.applied, seq: null, recordIndex,
        });
      } else {
        receipts.push({
          changeId, index, result: "rejected",
          reason: SYNC_RECEIPT_REASONS.invalidEntityId, seq: null, recordIndex: null,
        });
      }
    } catch (e) {
      logger.error("[sync] apply failed", c.entityType, c.entityId, e);
      receipts.push({
        changeId, index, result: "rejected",
        reason: SYNC_RECEIPT_REASONS.applyFailed, seq: null, recordIndex: null,
      });
    }
  }
  return { applied, okChanges, receipts };
}

// ---------------- collect (pull) ----------------
function change(
  entityType: SyncEntityType, entityId: string, operation: SyncOperation,
  payload: Record<string, unknown> | null, updatedAt: Date
): SyncChange {
  return { entityType, entityId, operation, version: 1, payload, updatedAt: updatedAt.toISOString() };
}

export interface CollectChangesOptions {
  /** 只返回这些实体（不传 = 全部，保持 v1 行为）；白名单由 shared/sync 定义 */
  entities?: readonly SyncEntityType[];
}

export async function collectChangesSince(
  client: PoolClient,
  uid: string,
  since: Date,
  options: CollectChangesOptions = {}
): Promise<SyncChange[]> {
  const wanted = new Set<SyncEntityType>(options.entities ?? SYNC_ENTITY_TYPES);
  const out: SyncChange[] = [];
  const q = (sql: string, params: unknown[]) => client.query(sql, params);

  {
    const { rows } = await q(
      `SELECT topic_id AS id, done, note, updated_at AS u, deleted_at AS d
       FROM topic_progress WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("progress", String(r.id), del ? "DELETE" : "UPDATE",
        del ? null : { done: r.done, note: r.note }, del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, task_date AS td, title, phase_id AS pid, topic_id AS tid,
              task_type AS tt, career_key AS ck, done, focus_minutes AS fm, sort_order AS so, updated_at AS u, deleted_at AS d
       FROM daily_tasks WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("tasks", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : {
          id: r.id, clientId: r.cid, taskDate: r.td, title: r.title, phaseId: r.pid,
          topicId: r.tid, taskType: r.tt, careerKey: r.ck, done: r.done, focusMinutes: r.fm, sortOrder: r.so,
        }, del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, task_id AS tid, started_at AS st, ended_at AS et,
              duration_seconds AS ds, tag, updated_at AS u, deleted_at AS d
       FROM focus_sessions WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("sessions", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : { id: r.id, clientId: r.cid, taskId: r.tid, startedAt: r.st, endedAt: r.et, durationSeconds: r.ds, tag: r.tag },
        del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT checkin_date AS cd, note, updated_at AS u, deleted_at AS d
       FROM checkins WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("checkins", String(r.cd), del ? "DELETE" : "UPDATE",
        del ? null : { checkinDate: r.cd, note: r.note }, del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, kind, career_key AS ck, title, content, created_at AS ca, updated_at AS u, deleted_at AS d
       FROM log_entries WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("logs", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : { id: r.id, clientId: r.cid, kind: r.kind, careerKey: r.ck, title: r.title, content: r.content, createdAt: r.ca },
        del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, title, url, content, updated_at AS u, deleted_at AS d
       FROM resume_assets WHERE user_id = $1 AND kind = 'github' AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("github", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : { id: r.id, clientId: r.cid, title: r.title, url: r.url, content: r.content },
        del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, phase_id AS pid, title, summary, sort_order AS so, updated_at AS u, deleted_at AS d
       FROM content_topics WHERE owner_id = $1 AND is_custom = TRUE AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("customTopics", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : { id: r.id, clientId: r.cid, phaseId: r.pid, title: r.title, summary: r.summary, sortOrder: r.so },
        del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, type, type_label AS tl, duration_seconds AS ds, source, note,
              started_at AS sa, updated_at AS u, deleted_at AS d
       FROM exercise_logs WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("exerciseLogs", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : {
          id: r.id, clientId: r.cid, type: r.type, typeLabel: r.tl, durationSeconds: r.ds,
          source: r.source, note: r.note, startedAt: r.sa,
        },
        del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, name, issuer, status, target_date AS td, earned_date AS ed,
              expiry_date AS xd, image_url AS iu, sort_order AS so, note, updated_at AS u, deleted_at AS d
       FROM certificates WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("certificates", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : {
          id: r.id, clientId: r.cid, name: r.name, issuer: r.issuer, status: r.status,
          targetDate: r.td, earnedDate: r.ed, expiryDate: r.xd, imageUrl: r.iu,
          sortOrder: r.so, note: r.note,
        },
        del ?? r.u));
    }
  }
  {
    const { rows } = await q(
      `SELECT id, client_id AS cid, name, icon, is_boolean AS ib, target_value AS tv, unit,
              schedule, color, sort_order AS so, updated_at AS u, deleted_at AS d
       FROM habits WHERE user_id = $1 AND (updated_at > $2 OR deleted_at > $2)`,
      [uid, since]
    );
    for (const r of rows) {
      const del = r.d;
      out.push(change("habits", r.cid || "srv-" + r.id, del ? "DELETE" : "UPDATE",
        del ? null : {
          id: r.id, clientId: r.cid, name: r.name, icon: r.icon, isBoolean: r.ib,
          targetValue: r.tv === null ? null : Number(r.tv), unit: r.unit,
          schedule: Array.isArray(r.schedule) ? r.schedule.map(Number) : [0, 1, 2, 3, 4, 5, 6],
          color: r.color, sortOrder: r.so,
        },
        del ?? r.u));
    }
  }
  {
    // habitLogs 需要 habit 的 client_id 才能稳定寻址；只同步已带 client_id 的习惯的打卡
    const { rows } = await q(
      `SELECT h.client_id AS hcid, l.log_date AS ld, l.value, l.note, l.updated_at AS u
       FROM habit_logs l
       JOIN habits h ON h.id = l.habit_id
      WHERE l.user_id = $1 AND h.client_id IS NOT NULL AND l.updated_at > $2`,
      [uid, since]
    );
    for (const r of rows) {
      const dateKey = String(r.ld).slice(0, 10);
      out.push(change("habitLogs", `${r.hcid}|${dateKey}`, "UPDATE",
        { habitClientId: r.hcid, logDate: dateKey, value: Number(r.value), note: r.note },
        r.u));
    }
  }

  /**
   * v2 后处理两步（保证游标分页跨请求稳定 + entities 白名单语义）：
   *  1) 白名单过滤（未知实体不返回）；
   *  2) 稳定排序：updatedAt 升序 → entityType → entityId。
   * 各实体的 SQL 未加 ORDER BY（避免 11 处改动 + 依赖 PG 执行计划），
   * 由这里统一排序，cursor(offset) 才可复现。
   */
  return out
    .filter((c) => wanted.has(c.entityType))
    .sort((a, b) => {
      if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? -1 : 1;
      if (a.entityType !== b.entityType) return a.entityType < b.entityType ? -1 : 1;
      return a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0;
    });
}

/* ============================ ledger 单源 pull（v2.1） ============================ */

/**
 * v2.1（评审 2026-10-31）：pull 的唯一事实源从"实体表 + updated_at 时间窗"迁移到
 * sync_changes ledger（seq 单调、写入顺序即到达顺序）。
 *
 * 为什么：
 *  - push 采纳客户端 updatedAt（LWW），设备离线补传旧时间戳变更时，其他设备
 *    时间窗游标已越过该时刻 → 永久不可见（评审 P1）；
 *  - offset 分页在集合变动时跳条/重复，且每页全量载入内存切片（评审 P0/P2）。
 * ledger 由 083 触发器对 11 张实体表的全部写路径自动填充；push 路径仍在事务内
 * recordSyncChanges（带 change_id 幂等），触发器经 `SET LOCAL app.sync_ledger` 让路。
 */

/** sync_changes 行（pg 原始形态：bigint→string，jsonb→object，timestamptz→Date） */
interface SyncChangeRow {
  seq: unknown;
  entity_type: string;
  entity_id: string;
  operation: string;
  version: unknown;
  payload: Record<string, unknown> | null;
  created_at: Date;
}

/** collect 口径：bigint id 一律 string（pg bigint 默认序列化） */
const idString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/**
 * ledger 行 → SyncChange。两种行来源、一种出口：
 *  - push 行（recordSyncChanges）：payload 已是 shared 契约形状（camelCase），原样透传；
 *  - 触发器行（083）：payload = to_jsonb(NEW/OLD) 原始 snake_case 行，按实体映射；
 *    字段逐一对照 collectChangesSince 的 SELECT 别名（本文件上方），保证两路径产出一致。
 * 软删除（payload.deleted_at 非空）与物理 DELETE 同 collect：operation=DELETE + payload=null。
 * 返回 null = 白名单外/无法表达的行（调用方跳过）。
 */
export function ledgerRowToChange(row: SyncChangeRow): SyncChange | null {
  const entityType = row.entity_type as SyncEntityType;
  if (!SYNC_ENTITY_TYPES.includes(entityType)) return null;
  const p = row.payload;
  const updatedAt = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
  const version = Number(row.version);
  const base = {
    entityType,
    entityId: row.entity_id,
    version: Number.isFinite(version) && version > 0 ? version : 1,
    updatedAt,
  } as const;

  if (row.operation === "DELETE") {
    return { ...base, operation: "DELETE", payload: null };
  }
  // 软删除：触发器行存的是 UPDATE 后的整行，deleted_at 非空即视为删除（与 collect 一致）
  if (p && p.deleted_at !== null && p.deleted_at !== undefined) {
    return { ...base, operation: "DELETE", payload: null };
  }
  if (!p) return null;

  // 双键取值：触发器行 payload 是 snake_case 原始行；push 行 payload 已是契约形状
  // （camelCase，字段名与 collect 输出一致）。两来源统一出口为 collect 口径的 camelCase。
  let payload: Record<string, unknown>;
  switch (entityType) {
    case "progress":
      payload = { done: p.done, note: p.note ?? null };
      break;
    case "tasks":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null,
        taskDate: p.taskDate ?? p.task_date, title: p.title,
        phaseId: p.phaseId ?? p.phase_id, topicId: p.topicId ?? p.topic_id,
        taskType: p.taskType ?? p.task_type, careerKey: p.careerKey ?? p.career_key,
        done: p.done, focusMinutes: p.focusMinutes ?? p.focus_minutes,
        sortOrder: p.sortOrder ?? p.sort_order,
      };
      break;
    case "sessions":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null,
        taskId: p.taskId ?? p.task_id,
        startedAt: p.startedAt ?? p.started_at, endedAt: p.endedAt ?? p.ended_at,
        durationSeconds: p.durationSeconds ?? p.duration_seconds, tag: p.tag ?? null,
      };
      break;
    case "checkins":
      payload = { checkinDate: p.checkinDate ?? p.checkin_date, note: p.note ?? null };
      break;
    case "logs":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null, kind: p.kind,
        careerKey: p.careerKey ?? p.career_key, title: p.title, content: p.content,
        createdAt: p.createdAt ?? p.created_at,
      };
      break;
    case "github":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null, title: p.title,
        url: p.url ?? null, content: p.content ?? null,
      };
      break;
    case "customTopics":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null,
        phaseId: p.phaseId ?? p.phase_id, title: p.title, summary: p.summary ?? null,
        sortOrder: p.sortOrder ?? p.sort_order,
      };
      break;
    case "exerciseLogs":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null, type: p.type,
        typeLabel: p.typeLabel ?? p.type_label ?? null,
        durationSeconds: p.durationSeconds ?? p.duration_seconds, source: p.source ?? null,
        note: p.note ?? null, startedAt: p.startedAt ?? p.started_at,
      };
      break;
    case "certificates":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null, name: p.name,
        issuer: p.issuer ?? null, status: p.status,
        targetDate: p.targetDate ?? p.target_date, earnedDate: p.earnedDate ?? p.earned_date,
        expiryDate: p.expiryDate ?? p.expiry_date, imageUrl: p.imageUrl ?? p.image_url,
        sortOrder: p.sortOrder ?? p.sort_order, note: p.note ?? null,
      };
      break;
    case "habits":
      payload = {
        id: idString(p.id), clientId: p.clientId ?? p.client_id ?? null, name: p.name,
        icon: p.icon ?? null, isBoolean: p.isBoolean ?? p.is_boolean,
        targetValue: (p.targetValue ?? p.target_value) === null || (p.targetValue ?? p.target_value) === undefined
          ? null
          : Number(p.targetValue ?? p.target_value),
        unit: p.unit ?? null,
        schedule: Array.isArray(p.schedule) ? p.schedule.map(Number) : [0, 1, 2, 3, 4, 5, 6],
        color: p.color ?? null, sortOrder: p.sortOrder ?? p.sort_order,
      };
      break;
    case "habitLogs":
      payload = {
        // 触发器的 entity_id = '<habitClientId>|<logDate>'；push 行 payload 自带 habitClientId
        habitClientId: typeof p.habitClientId === "string" ? p.habitClientId : row.entity_id.split("|")[0] ?? "",
        logDate: String(p.logDate ?? p.log_date ?? "").slice(0, 10),
        value: Number(p.value),
        note: p.note ?? null,
      };
      break;
    default:
      return null;
  }
  return { ...base, operation: row.operation === "CREATE" ? "CREATE" : "UPDATE", payload };
}

export interface LedgerCollectResult {
  changes: SyncChange[];
  hasMore: boolean;
  /** 本页最后一行的 seq（本页为空时 = 传入的 afterSeq）；客户端持久化为下一轮起点 */
  lastSeq: number;
}

/**
 * ledger 顺序回放：`seq > afterSeq ORDER BY seq LIMIT n`。
 * - seq 全局单调 → 新写入自然落在后续页/后续轮，无 offset 跳条问题；
 * - 多取 1 行判断 hasMore，避免"取满即有下一页"的歧义；
 * - entities 白名单由 SQL 侧 `entity_type = ANY` 过滤（与 legacy 语义一致）。
 */
export async function collectChangesFromLedger(
  client: PoolClient,
  uid: string,
  afterSeq: number,
  limit: number,
  options: CollectChangesOptions = {}
): Promise<LedgerCollectResult> {
  const wanted = options.entities ?? null;
  const fetchLimit = limit + 1;
  const { rows } = wanted
    ? await client.query(
        `SELECT seq, entity_type, entity_id, operation, version, payload, created_at
         FROM sync_changes WHERE user_id = $1 AND seq > $2 AND entity_type = ANY($3)
         ORDER BY seq LIMIT $4`,
        [uid, afterSeq, wanted, fetchLimit]
      )
    : await client.query(
        `SELECT seq, entity_type, entity_id, operation, version, payload, created_at
         FROM sync_changes WHERE user_id = $1 AND seq > $2
         ORDER BY seq LIMIT $3`,
        [uid, afterSeq, fetchLimit]
      );

  const page = rows.slice(0, limit) as SyncChangeRow[];
  const changes = page
    .map(ledgerRowToChange)
    .filter((c): c is SyncChange => c !== null);
  const lastRow = page[page.length - 1];
  const lastSeq = lastRow ? Number(lastRow.seq) : afterSeq;
  return {
    changes,
    hasMore: rows.length > limit,
    lastSeq: Number.isFinite(lastSeq) ? lastSeq : afterSeq,
  };
}

/**
 * 该用户 ledger 现存最小 seq（无行返回 0）。维护任务按 90 天修剪 sync_changes；
 * 客户端发现 `ledgerMinSeq > lastSeq + 1`（且 lastSeq>0）说明游标已被修剪越过，须重置全量重拉。
 */
export async function getLedgerMinSeq(client: PoolClient, uid: string): Promise<number> {
  const { rows } = await client.query(`SELECT MIN(seq) AS min_seq FROM sync_changes WHERE user_id = $1`, [uid]);
  const raw = (rows[0] as { min_seq?: unknown } | undefined)?.min_seq;
  const n = raw === null || raw === undefined ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 写同步变更日志并用 `RETURNING seq` 取回**单调序号**（S5-2）。
 *
 * 返回与入参 changes 等长的 seq 数组（并发/罕见冲突时可能为 null）：
 * 路由按回执的 recordIndex 把 seq 回填到 applied 回执里，客户端据此在
 * 同 updatedAt 平局时比较"谁的 seq 更大"。
 */
export async function recordSyncChanges(
  client: PoolClient, uid: string, deviceId: string | null, changes: SyncChange[]
): Promise<Array<number | null>> {
  const seqs: Array<number | null> = [];
  const toSeq = (raw: unknown): number | null =>
    raw === null || raw === undefined || !Number.isFinite(Number(raw)) ? null : Number(raw);

  for (const c of changes) {
    const payloadJson = c.payload ? JSON.stringify(c.payload) : null;
    if (c.changeId) {
      // B5 幂等：重复推送不重复记录审计日志；RETURNING seq 让回执能带回既有序号
      const { rows } = await client.query(
        `INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at, change_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
         ON CONFLICT (user_id, change_id) WHERE change_id IS NOT NULL DO NOTHING
         RETURNING seq`,
        [uid, deviceId, c.entityType, c.entityId, c.operation, c.version, payloadJson, new Date(c.updatedAt), c.changeId]
      );
      if (rows.length > 0) {
        seqs.push(toSeq((rows[0] as { seq?: unknown }).seq));
        continue;
      }
      // 并发重复推送：另一个事务先写入（ON CONFLICT DO NOTHING 不返回行）→ 读回既有 seq
      const existing = await client.query(
        `SELECT seq FROM sync_changes WHERE user_id = $1 AND change_id = $2`,
        [uid, c.changeId]
      );
      seqs.push(toSeq((existing.rows[0] as { seq?: unknown } | undefined)?.seq));
      continue;
    }
    const { rows } = await client.query(
      `INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING seq`,
      [uid, deviceId, c.entityType, c.entityId, c.operation, c.version, payloadJson, new Date(c.updatedAt)]
    );
    seqs.push(toSeq((rows[0] as { seq?: unknown } | undefined)?.seq));
  }
  return seqs;
}

export async function upsertSyncDevice(
  client: PoolClient, uid: string, deviceId: string, name?: string | null
): Promise<void> {
  await client.query(
    `INSERT INTO sync_devices (user_id, device_id, name, last_sync_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, device_id) DO UPDATE SET name = COALESCE(EXCLUDED.name, sync_devices.name), last_sync_at = now()`,
    [uid, deviceId, name ?? null]
  );
}
