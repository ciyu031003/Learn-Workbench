/**
 * 内容导入落库（组二 · 阶段 10 = V3 纵线 Phase F）。
 *
 * 分工：
 *   - `apps/web/lib/content/import-plan.mjs`：**纯逻辑**（外部键/指纹/五桶规划/冲突口径），CLI 与服务端共用一份；
 *   - 这里：读库拿"已导入过的外部键"、写 `content_import_batch` / `content_import_item`、按 mode 决定是否物化。
 *
 * 三条硬约束（都是"不能自动上线"的具体化）：
 *   1. 导入物化一律 `status='review'`（草稿区），绝不写 published —— 内容权威仍在 packages/content；
 *   2. 物化 upsert 带 `WHERE status = 'review'` 守卫：目标键若已是 published（内容包管的行），
 *      写入 0 行并把该条目改判为 conflict(target-published)，绝不覆盖上线内容；
 *   3. `usage='reference'` 的来源只允许 dry-run —— 只保留外链，不复制正文。
 *
 * 题目（kind='question'）不物化：学习库题目来自内容包，库里没有题目表。
 * 导入的题目登记为**待人工写进内容包的工作项**（payload 存原样），由 `report.staged` 如实回报。
 */
import type { PoolClient } from "pg";
import { fingerprintOf, planImport, type ImportAction } from "./import-plan.mjs";
import { pgPool } from "@/lib/db";

export type ContentImportMode = "dry-run" | "apply";
export type ContentImportKind = "knowledge-point" | "question";

export interface ContentImportItemInput {
  kind: ContentImportKind;
  externalKey?: string;
  targetKey: string;
  title: string;
  path?: string;
  unmapped?: boolean;
  payload?: Record<string, unknown>;
  hasAnswer?: boolean;
}

export interface RunContentImportOptions {
  sourceKey: string;
  mode: ContentImportMode;
  commitSha?: string | null;
  scope?: string[];
  items: ContentImportItemInput[];
  createdBy?: string;
}

export interface ContentImportBatchResult {
  batchId: number;
  sourceKey: string;
  mode: ContentImportMode;
  status: "success" | "partial" | "failed";
  counts: Record<ImportAction, number>;
  applied: { new: number; update: number; skipped: number };
  staged: { questions: number };
  commitSha: string | null;
}

export class ContentImportError extends Error {
  constructor(
    message: string,
    readonly code: "source-not-found" | "source-not-importable" | "no-items" | "batch-not-found",
    readonly status = 400
  ) {
    super(message);
  }
}

const ITEM_CHUNK = 500;

interface ExistingItem {
  externalKey: string;
  kind: ContentImportKind;
  targetKey: string;
  fingerprint: string;
  hasAnswer: boolean;
}

interface ImportRow {
  kind: ContentImportKind;
  externalKey: string;
  targetKey: string;
  title: string;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function textOrNull(value: unknown, max: number): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, max) : null;
}

/**
 * 已导入的外部键：取该来源**上一次成功 apply 批次**里每个外部键的终态。
 * 只认 mode='apply' —— dry-run 批次不能当"已导入"的证据，否则第二次 dry-run 会全判成 unchanged。
 */
async function loadExisting(client: PoolClient, sourceKey: string): Promise<ExistingItem[]> {
  const { rows } = await client.query<{
    kind: string;
    externalKey: string;
    targetKey: string | null;
    payload: Record<string, unknown> | null;
  }>(
    `SELECT DISTINCT ON (i.kind, i.external_key)
            i.kind, i.external_key AS "externalKey", i.target_key AS "targetKey", i.payload
       FROM content_import_item i
       JOIN content_import_batch b ON b.id = i.batch_id
      WHERE b.source_key = $1 AND b.mode = 'apply' AND b.status IN ('success', 'partial')
        AND i.action IN ('new', 'update')
      ORDER BY i.kind, i.external_key, i.batch_id DESC, i.id DESC`,
    [sourceKey]
  );
  return rows.map((row) => ({
    externalKey: String(row.externalKey),
    kind: row.kind as ContentImportKind,
    targetKey: String(row.targetKey ?? ""),
    fingerprint: fingerprintOf(row.payload ?? {}),
    hasAnswer: Boolean(textOrNull(row.payload?.answer, 1)),
  }));
}

/**
 * 物化知识点草稿。守卫 `WHERE status = 'review'`：目标键已是 published 时写 0 行，
 * 调用方据此改判 conflict(target-published)。
 */
const REVIEW_UPSERT_SQL = `
INSERT INTO knowledge_points
  (key, track_slug, stage_key, topic_key, track_title, stage_title, title, summary,
   sort_order, stage_order, topic_order, status, quality_level, quality_missing, difficulty,
   estimated_minutes, fingerprint, content_version, source_key, tags, deleted_at)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'review', $12, $13::jsonb, $14,
   $15, $16, 'import', $17, $18::jsonb, NULL)
ON CONFLICT (key) DO UPDATE SET
  track_slug = EXCLUDED.track_slug,
  stage_key = EXCLUDED.stage_key,
  topic_key = EXCLUDED.topic_key,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  quality_level = EXCLUDED.quality_level,
  quality_missing = EXCLUDED.quality_missing,
  difficulty = EXCLUDED.difficulty,
  estimated_minutes = EXCLUDED.estimated_minutes,
  fingerprint = EXCLUDED.fingerprint,
  source_key = EXCLUDED.source_key,
  tags = EXCLUDED.tags,
  updated_at = now()
WHERE knowledge_points.status = 'review'`;

function reviewPointParams(row: ImportRow, payload: Record<string, unknown>, sourceKey: string): unknown[] | null {
  const trackSlug = textOrNull(payload.trackSlug, 60);
  const stageKey = textOrNull(payload.stageKey, 80);
  const topicKey = textOrNull(payload.topicKey, 80);
  const title = textOrNull(payload.title, 200) ?? textOrNull(row.title, 200);
  // 草稿也要有归属：没有 track/stage/topic 就没法出现在任何课程页，直接拒绝物化
  if (!trackSlug || !stageKey || !topicKey || !title) return null;
  return [
    row.targetKey,
    trackSlug,
    stageKey,
    topicKey,
    textOrNull(payload.trackTitle, 120) ?? "",
    textOrNull(payload.stageTitle, 120) ?? "",
    title,
    textOrNull(payload.summary, 500) ?? "",
    Number.isFinite(Number(payload.sortOrder)) ? Math.trunc(Number(payload.sortOrder)) : 0,
    Number.isFinite(Number(payload.stageOrder)) ? Math.trunc(Number(payload.stageOrder)) : 0,
    Number.isFinite(Number(payload.topicOrder)) ? Math.trunc(Number(payload.topicOrder)) : 0,
    textOrNull(payload.qualityLevel, 4) ?? "L1",
    JSON.stringify(Array.isArray(payload.qualityMissing) ? payload.qualityMissing : []),
    ["easy", "medium", "hard"].includes(String(payload.difficulty))
      ? String(payload.difficulty)
      : "medium",
    Number.isFinite(Number(payload.estimatedMinutes)) ? Math.max(0, Math.trunc(Number(payload.estimatedMinutes))) : 5,
    textOrNull(payload.fingerprint, 40) ?? fingerprintOf(payload),
    sourceKey,
    JSON.stringify(Array.isArray(payload.tags) ? payload.tags.slice(0, 12) : []),
  ];
}

/**
 * 跑一次导入。单事务：批次、明细、物化要么全成，要么全不写。
 * 冲突/失败**不会**让整批回滚 —— 它们正是要落进明细给人工看的，所以批次状态记 partial。
 */
export async function runContentImport(options: RunContentImportOptions): Promise<ContentImportBatchResult> {
  const sourceKey = String(options.sourceKey ?? "").trim();
  const items = Array.isArray(options.items) ? options.items : [];
  if (items.length === 0) throw new ContentImportError("items 不能为空", "no-items");

  const scope = Array.isArray(options.scope) ? options.scope.map((s) => String(s)) : [];
  const mode: ContentImportMode = options.mode === "apply" ? "apply" : "dry-run";
  const createdBy = textOrNull(options.createdBy, 40) ?? "cli";
  const commitSha = textOrNull(options.commitSha, 64);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: sourceRows } = await client.query<{ key: string; usage: string; status: string }>(
      "SELECT key, usage, status FROM content_source WHERE key = $1",
      [sourceKey]
    );
    const source = sourceRows[0];
    if (!source) throw new ContentImportError(`来源未登记：${sourceKey}`, "source-not-found", 404);
    if (source.status !== "active") {
      throw new ContentImportError(`来源已停用（status=${source.status}）：${sourceKey}`, "source-not-importable");
    }
    if (source.usage !== "import" && mode === "apply") {
      throw new ContentImportError(
        `来源 usage=${source.usage} 只允许 dry-run：只保留外链，不复制正文`,
        "source-not-importable"
      );
    }

    const existing = await loadExisting(client, sourceKey);
    const incoming = items.map((item) => ({
      kind: item.kind,
      externalKey: String(item.externalKey ?? ""),
      targetKey: String(item.targetKey ?? ""),
      title: String(item.title ?? ""),
      path: item.path,
      unmapped: item.unmapped === true,
      payload: item.payload ?? {},
      hasAnswer: item.hasAnswer,
      fingerprint: fingerprintOf(item.payload ?? {}),
    }));

    const plan = planImport({ existing, incoming, scope, options: {} });
    const planned = {
      new: plan.new.length,
      update: plan.update.length,
      skip: plan.skip.length,
      conflict: plan.conflict.length,
      failed: plan.failed.length,
    };

    const { rows: batchRows } = await client.query<{ id: string }>(
      `INSERT INTO content_import_batch
         (source_key, mode, status, commit_sha, scope, planned_new, planned_update, planned_skip,
          planned_conflict, planned_failed, created_by)
       VALUES ($1, $2, 'running', $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        sourceKey,
        mode,
        commitSha,
        JSON.stringify(scope),
        planned.new,
        planned.update,
        planned.skip,
        planned.conflict,
        planned.failed,
        createdBy,
      ]
    );
    const batchId = Number(batchRows[0].id);

    // 明细：唯一键 (batch_id, kind, external_key)，重复提交同一批不会炸
    const itemRows: Array<[string, string, string, string, string | null, string | null, string | null]> = [];
    for (const bucket of ["new", "update", "skip", "conflict", "failed"] as ImportAction[]) {
      for (const item of plan[bucket] as Array<Record<string, unknown>>) {
        itemRows.push([
          String(item.kind),
          String(item.externalKey),
          textOrNull(item.targetKey, 160) ?? "",
          bucket,
          textOrNull(item.reason, 80),
          JSON.stringify(item.payload ?? {}),
          textOrNull(item.title, 200),
        ]);
      }
    }
    for (const part of chunk(itemRows, ITEM_CHUNK)) {
      await client.query(
        `INSERT INTO content_import_item
           (batch_id, kind, external_key, target_key, action, reason, payload)
         SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::jsonb[])
         ON CONFLICT (batch_id, kind, external_key) DO UPDATE SET
           target_key = EXCLUDED.target_key,
           action = EXCLUDED.action,
           reason = EXCLUDED.reason,
           payload = EXCLUDED.payload`,
        [
          batchId,
          part.map((r) => r[0]),
          part.map((r) => r[1]),
          part.map((r) => r[2]),
          part.map((r) => r[3]),
          part.map((r) => r[4]),
          part.map((r) => r[5]),
        ]
      );
    }

    let stagedQuestions = 0;
    if (mode === "apply") {
      // 只物化知识点；题目登记为工作项（学习库题目来自内容包，库里没有题目表）
      const materialize = plan.new
        .concat(plan.update)
        .filter((item: Record<string, unknown>) => item.kind === "knowledge-point");
      const blocked: string[] = [];
      for (const item of materialize as Array<Record<string, unknown>>) {
        const payload = (item.payload ?? {}) as Record<string, unknown>;
        const params = reviewPointParams(
          item as unknown as ImportRow,
          payload,
          sourceKey
        );
        if (!params) {
          blocked.push(String(item.externalKey));
          continue;
        }
        const res = await client.query(REVIEW_UPSERT_SQL, params);
        // 0 行 = 目标键已被内容包占用（published），改判 conflict，绝不覆盖上线内容
        if ((res.rowCount ?? 0) === 0) blocked.push(String(item.externalKey));
      }
      for (const part of chunk(blocked, ITEM_CHUNK)) {
        await client.query(
          `UPDATE content_import_item
              SET action = 'conflict', reason = 'target-published'
            WHERE batch_id = $1 AND external_key = ANY($2::text[])`,
          [batchId, part]
        );
      }

      const staged = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM content_import_item
          WHERE batch_id = $1 AND kind = 'question' AND action IN ('new', 'update')`,
        [batchId]
      );
      stagedQuestions = Number(staged.rows[0]?.n ?? 0);

      await client.query(
        "UPDATE content_source SET last_synced_at = now(), commit_sha = COALESCE($2, commit_sha) WHERE key = $1",
        [sourceKey, commitSha]
      );
    }

    // 终态计数以**明细表**为准（物化阶段可能把 new 改判成 conflict）
    const { rows: countRows } = await client.query<{ action: string; n: string }>(
      "SELECT action, count(*)::text AS n FROM content_import_item WHERE batch_id = $1 GROUP BY action",
      [batchId]
    );
    const counts: Record<ImportAction, number> = { new: 0, update: 0, skip: 0, conflict: 0, failed: 0 };
    for (const row of countRows) {
      if (row.action in counts) counts[row.action as ImportAction] = Number(row.n);
    }

    const notClean = counts.conflict + counts.failed;
    const materialized = counts.new + counts.update + counts.skip;
    const status: ContentImportBatchResult["status"] =
      notClean === 0 ? "success" : materialized === 0 ? "failed" : "partial";
    const applied = {
      new: mode === "apply" ? counts.new : 0,
      update: mode === "apply" ? counts.update : 0,
      skipped: counts.skip,
    };
    const report = {
      planned,
      counts,
      staged: { questions: stagedQuestions },
      materialized: mode === "apply",
    };

    await client.query(
      `UPDATE content_import_batch
          SET status = $2, applied_new = $3, applied_update = $4, applied_skipped = $5,
              report = $6::jsonb, finished_at = now()
        WHERE id = $1`,
      [batchId, status, applied.new, applied.update, applied.skipped, JSON.stringify(report)]
    );

    await client.query("COMMIT");
    return { batchId, sourceKey, mode, status, counts, applied, staged: { questions: stagedQuestions }, commitSha };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** 回滚一批导入：只把**该批次新建的 review 草稿**软归档，绝不物理删；批次标记 rolled-back。 */
export async function rollbackContentImport(batchId: number): Promise<{ archived: number; batchId: number }> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ status: string; mode: string }>(
      "SELECT status, mode FROM content_import_batch WHERE id = $1 FOR UPDATE",
      [batchId]
    );
    if (!rows[0]) throw new ContentImportError(`批次不存在：${batchId}`, "batch-not-found", 404);
    if (rows[0].mode !== "apply") {
      throw new ContentImportError(`dry-run 批次无需回滚：${batchId}`, "source-not-importable");
    }
    const archived = await client.query(
      `UPDATE knowledge_points kp
          SET status = 'archived', updated_at = now()
         FROM content_import_item i
        WHERE i.batch_id = $1 AND i.kind = 'knowledge-point' AND i.action = 'new'
          AND i.target_key = kp.key AND kp.status = 'review'`,
      [batchId]
    );
    await client.query(
      "UPDATE content_import_batch SET status = 'rolled-back', finished_at = now() WHERE id = $1",
      [batchId]
    );
    await client.query("COMMIT");
    return { archived: archived.rowCount ?? 0, batchId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
