import { pgPool } from "@/lib/db";

/**
 * 知识点的应用层写入路径（组三 · H1 收口：乐观锁写入路径）。
 *
 * 背景：迁移 `064` 已给 `knowledge_points` 等运营可编辑表补上 `version` 乐观锁列与
 * `created_by` / `updated_by` 审计列，但一直**没有应用层写入口**——数据层与契约先落地，
 * 却没有代码真正用 `WHERE version = $expected` 去防脏写。这里补上这条路径：
 *
 *   - 读：`getKnowledgePoint(key)` 返回当前 `version`，客户端拿它做编辑的基线；
 *   - 写：`updateKnowledgePoint({ key, expectedVersion, ... })` 以
 *     `UPDATE ... WHERE key = $1 AND version = $2` 落库，命中 0 行时分清
 *     「不存在」与「版本冲突（别人先改了）」两种失败，绝不静默覆盖；
 *   - 每次成功写入 `version = version + 1`，并记录 `updated_by`。
 *
 * 本文件不做鉴权（那是路由 `guardInternalRequest` 的职责），也不做可视化编辑入口
 * （按看板口径：先落数据层与契约，界面另行排期）。
 */

export const KNOWLEDGE_POINT_STATUSES = ["draft", "review", "published", "archived"] as const;
export type KnowledgePointStatus = (typeof KNOWLEDGE_POINT_STATUSES)[number];

export function isKnowledgePointStatus(value: unknown): value is KnowledgePointStatus {
  return typeof value === "string" && (KNOWLEDGE_POINT_STATUSES as readonly string[]).includes(value);
}

export interface KnowledgePointSnapshot {
  key: string;
  title: string;
  summary: string;
  status: KnowledgePointStatus;
  tags: string[];
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface KnowledgePointPatch {
  title?: string;
  summary?: string;
  status?: KnowledgePointStatus;
  tags?: string[];
}

export type NormalizeResult =
  | { ok: true; patch: KnowledgePointPatch }
  | { ok: false; message: string };

const MAX_TITLE = 200;
const MAX_SUMMARY = 500;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

/**
 * 归一化并校验编辑补丁（纯函数，便于单测；路由与 lib 共用同一份口径）。
 * 只接受白名单字段，未知字段忽略而不是报错——调用方多为脚本，宽进严出。
 */
export function normalizeKnowledgePointPatch(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== "object") return { ok: false, message: "编辑内容必须是对象" };
  const input = raw as Record<string, unknown>;
  const patch: KnowledgePointPatch = {};

  if (input.title !== undefined) {
    const title = String(input.title ?? "").trim();
    if (!title) return { ok: false, message: "标题不能为空" };
    if (title.length > MAX_TITLE) return { ok: false, message: `标题不能超过 ${MAX_TITLE} 字` };
    patch.title = title;
  }

  if (input.summary !== undefined) {
    const summary = String(input.summary ?? "").trim();
    if (summary.length > MAX_SUMMARY) return { ok: false, message: `摘要不能超过 ${MAX_SUMMARY} 字` };
    patch.summary = summary;
  }

  if (input.status !== undefined) {
    if (!isKnowledgePointStatus(input.status)) {
      return { ok: false, message: "状态必须是 draft / review / published / archived" };
    }
    patch.status = input.status;
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) return { ok: false, message: "tags 必须是字符串数组" };
    if (input.tags.length > MAX_TAGS) return { ok: false, message: `tags 最多 ${MAX_TAGS} 项` };
    const tags: string[] = [];
    for (const item of input.tags) {
      if (typeof item !== "string") return { ok: false, message: "tags 必须是字符串数组" };
      const tag = item.trim();
      if (!tag) continue;
      if (tag.length > MAX_TAG_LENGTH) return { ok: false, message: `单个标签不能超过 ${MAX_TAG_LENGTH} 字` };
      tags.push(tag);
    }
    patch.tags = [...new Set(tags)];
  }

  if (Object.keys(patch).length === 0) return { ok: false, message: "没有可更新的字段" };
  return { ok: true, patch };
}

export type UpdateKnowledgePointResult =
  | { ok: true; key: string; version: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "version_conflict"; currentVersion: number };

interface UpdateInput {
  key: string;
  expectedVersion: number;
  patch: KnowledgePointPatch;
  actorId?: string | null;
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag));
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed.map((tag) => String(tag));
    } catch {
      // 非 JSON 字符串：忽略，按空标签处理
    }
  }
  return [];
}

/** 读一个知识点的当前快照（含乐观锁 version），供编辑前取得基线。 */
export async function getKnowledgePoint(key: string): Promise<KnowledgePointSnapshot | null> {
  const { rows } = await pgPool.query<{
    key: string;
    title: string;
    summary: string;
    status: string;
    tags: unknown;
    version: number;
    updated_at: Date | string | null;
    updated_by: string | null;
  }>(
    `SELECT key, title, summary, status, tags, version, updated_at, updated_by
       FROM knowledge_points WHERE key = $1 AND deleted_at IS NULL`,
    [key]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    key: String(row.key),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    status: isKnowledgePointStatus(row.status) ? row.status : "published",
    tags: normalizeTags(row.tags),
    version: Number(row.version ?? 1),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedBy: row.updated_by ?? null,
  };
}

/**
 * 乐观锁写入：只有 `version` 与调用方给出的 `expectedVersion` 一致才落库。
 * 命中 0 行时再查一次当前 version，区分「不存在」与「被别人先改了」。
 */
export async function updateKnowledgePoint(input: UpdateInput): Promise<UpdateKnowledgePointResult> {
  const { key, expectedVersion, patch, actorId = null } = input;
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("expectedVersion 必须是 >= 1 的整数");
  }

  const { rowCount, rows } = await pgPool.query<{ version: number }>(
    `UPDATE knowledge_points
        SET title = COALESCE($3, title),
            summary = COALESCE($4, summary),
            status = COALESCE($5, status),
            tags = COALESCE($6::jsonb, tags),
            updated_by = COALESCE($7, updated_by),
            version = version + 1,
            updated_at = now()
      WHERE key = $1 AND version = $2 AND deleted_at IS NULL
      RETURNING version`,
    [
      key,
      expectedVersion,
      patch.title ?? null,
      patch.summary ?? null,
      patch.status ?? null,
      patch.tags ? JSON.stringify(patch.tags) : null,
      actorId,
    ]
  );

  if ((rowCount ?? 0) > 0) {
    return { ok: true, key, version: Number(rows[0]?.version ?? expectedVersion + 1) };
  }

  const current = await pgPool.query<{ version: number }>(
    `SELECT version FROM knowledge_points WHERE key = $1 AND deleted_at IS NULL`,
    [key]
  );
  if (current.rows.length === 0) return { ok: false, reason: "not_found" };
  return { ok: false, reason: "version_conflict", currentVersion: Number(current.rows[0].version ?? 1) };
}
