import type { PoolClient } from "pg";
import { logger } from "@/lib/logger";
import { exerciseTypeSchema } from "@learn-workbench/shared";

// ============================================================================
// 增量同步核心（方案 §37-§40）
// - 实体统一带 updated_at / deleted_at（软删除）
// - 代理键实体带 client_id（跨设备稳定 ID）
// - 冲突策略：Last-Write-Wins（按 updated_at）
// - push：applyChanges；pull：collectChangesSince
// ============================================================================

export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";

export interface SyncChange {
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  version: number;
  payload: Record<string, unknown> | null;
  updatedAt: string;
  /** 幂等键（B5）：客户端生成的稳定 ID，重试推送按 (user_id, change_id) 去重 */
  changeId?: string;
}

export const SYNC_ENTITY_TYPES = [
  "progress",
  "tasks",
  "sessions",
  "checkins",
  "logs",
  "github",
  "customTopics",
  "exerciseLogs",
  "certificates",
  "habits",
  "habitLogs",
] as const;

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

export async function applyChanges(
  client: PoolClient, uid: string, changes: SyncChange[]
): Promise<{ applied: number; okChanges: SyncChange[] }> {
  let applied = 0;
  const okChanges: SyncChange[] = [];
  for (const c of changes) {
    const fn = APPLIERS[c.entityType];
    if (!fn) continue;
    // B5 幂等：该 changeId 已应用过（客户端重试），直接跳过
    if (c.changeId) {
      const { rows } = await client.query(
        `SELECT 1 FROM sync_changes WHERE user_id = $1 AND change_id = $2`,
        [uid, c.changeId]
      );
      if (rows.length > 0) continue;
    }
    try {
      const ok = await fn(client, uid, c, atOf(c));
      if (ok) {
        applied++;
        okChanges.push(c);
      }
    } catch (e) {
      logger.error("[sync] apply failed", c.entityType, c.entityId, e);
    }
  }
  return { applied, okChanges };
}

// ---------------- collect (pull) ----------------
function change(
  entityType: string, entityId: string, operation: SyncOperation,
  payload: Record<string, unknown> | null, updatedAt: Date
): SyncChange {
  return { entityType, entityId, operation, version: 1, payload, updatedAt: updatedAt.toISOString() };
}

export async function collectChangesSince(client: PoolClient, uid: string, since: Date): Promise<SyncChange[]> {
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
  return out;
}

export async function recordSyncChanges(
  client: PoolClient, uid: string, deviceId: string | null, changes: SyncChange[]
): Promise<void> {
  for (const c of changes) {
    if (c.changeId) {
      // B5 幂等：重复推送不重复记录审计日志
      await client.query(
        `INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at, change_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
         ON CONFLICT (user_id, change_id) WHERE change_id IS NOT NULL DO NOTHING`,
        [uid, deviceId, c.entityType, c.entityId, c.operation, c.version, c.payload ? JSON.stringify(c.payload) : null, new Date(c.updatedAt), c.changeId]
      );
      continue;
    }
    await client.query(
      `INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [uid, deviceId, c.entityType, c.entityId, c.operation, c.version, c.payload ? JSON.stringify(c.payload) : null, new Date(c.updatedAt)]
    );
  }
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
