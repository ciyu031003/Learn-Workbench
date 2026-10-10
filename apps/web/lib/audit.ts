import { pgPool } from "./db";
import { logger } from "./logger";

/**
 * 操作审计（组三 · H3 安全纵深）。
 *
 * 取舍：**best-effort 写入**。
 *  - 审计表挂了不应该连带把业务写操作一起打挂（可用性优先）；
 *  - 但失败必须留 ERROR 日志，且 `action` / `requestId` 都在，能从日志侧还原。
 *  对"绝对不能没有审计"的高危操作（未来若做权限变更），调用方可以传 `required: true` 走硬失败。
 */

export const AUDIT_ACTOR_TYPES = ["user", "system", "cron", "cli", "anon"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  actorType?: AuditActorType;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  requestId?: string | null;
  ip?: string | null;
  /** true = 写审计失败时抛出（高危操作才用） */
  required?: boolean;
}

export interface AuditRecord {
  id: number;
  actorId: string | null;
  actorType: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown>;
  requestId: string | null;
  ip: string | null;
  createdAt: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await pgPool.query(
      `INSERT INTO audit_log (actor_id, actor_type, action, target_type, target_id, meta, request_id, ip)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        entry.actorId ?? null,
        entry.actorType ?? "system",
        entry.action,
        entry.targetType ?? null,
        entry.targetId ?? null,
        JSON.stringify(entry.meta ?? {}),
        entry.requestId ?? null,
        entry.ip ?? null,
      ]
    );
  } catch (error) {
    if (entry.required) throw error;
    logger.error("audit log write failed", error, entry.action);
  }
}

/** 查询审计（管理端用；limit 有上限，避免一次拉全表）。 */
export async function listAuditLog(opts: { limit?: number; action?: string; actorId?: string } = {}): Promise<AuditRecord[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts.action) {
    params.push(opts.action);
    where.push(`action = $${params.length}`);
  }
  if (opts.actorId) {
    params.push(opts.actorId);
    where.push(`actor_id = $${params.length}`);
  }
  params.push(limit);
  const { rows } = await pgPool.query(
    `SELECT id, actor_id AS "actorId", actor_type AS "actorType", action,
            target_type AS "targetType", target_id AS "targetId", meta,
            request_id AS "requestId", ip, created_at AS "createdAt"
       FROM audit_log
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY id DESC
      LIMIT $${params.length}`,
    params
  );
  return rows as AuditRecord[];
}
