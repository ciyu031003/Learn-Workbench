/**
 * 统一内容模型落库（组二 · 阶段 7 = V3 Phase A）。
 *
 * 分工：
 *   - `buildContentSyncPlan`：**纯函数**（内容包 → 待写入行），可单测、可 dry-run 预览；
 *   - `syncKnowledgeModel`：把 plan 写进库（单事务，幂等，可重复跑），并回报 inserted/updated/unchanged/archived；
 *   - `readContentPackageVersion`：内容包的版本来源（git 上 packages/content 的最后一次提交），
 *     作为 `content_version` / `content_updated_at` / `stale_after` 的真实依据，而不是手填日期。
 *
 * 幂等口径：
 *   - 知识点按主键 `key` upsert，指纹相同即"unchanged"（不写库、不改 updated_at）；
 *   - 关联行**只重写 derived**（`link_source/relation_source <> 'curated'`），人工审定的边不会被自动同步冲掉；
 *   - 模型里已消失的知识点只做**软归档**（status='archived'），不物理删 —— 历史作答与复习卡片仍可追溯。
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  buildKnowledgeModel,
  learningTracks,
  type KnowledgeModelStats,
  type LearningTrack,
} from "@learn-workbench/content";
import { pgPool } from "@/lib/db";

/** 内容复查周期：超过这个天数没更新就标记 stale（Phase G 的"可能过时"提示依赖它）。 */
export const DEFAULT_REVIEW_TTL_DAYS = 180;

/**
 * 内容包在仓库中的固定相对位置。用它向上找仓库根，而不是直接用 `process.cwd()`：
 * Next dev/build 的 cwd 是 `apps/web`，从那里跑 `git log -- packages/content/...` 什么也读不到，
 * 于是版本号会静默退化成 `unknown`（阶段 10 实测到）。
 */
const CONTENT_PACKAGE_MARKER = join("packages", "content", "src", "learning");

/** 从 cwd 逐级向上找到包含内容包的仓库根；找不到就返回 cwd，由调用方按"拿不到版本"处理。 */
export function resolveContentRepoRoot(cwd: string = process.cwd()): string {
  let dir = cwd;
  for (let depth = 0; depth < 4; depth++) {
    if (existsSync(join(dir, CONTENT_PACKAGE_MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}

export interface KnowledgePointWriteRow {
  key: string;
  trackSlug: string;
  stageKey: string;
  topicKey: string;
  trackTitle: string;
  stageTitle: string;
  title: string;
  summary: string;
  sortOrder: number;
  stageOrder: number;
  topicOrder: number;
  status: "published";
  qualityLevel: string;
  qualityMissing: string[];
  difficulty: string;
  estimatedMinutes: number;
  fingerprint: string;
  contentVersion: string;
  contentUpdatedAt: string | null;
  publishedAt: string;
  staleAfter: string;
  sourceKey: string | null;
  tags: string[];
}

export interface QuestionLinkWriteRow {
  questionKey: string;
  knowledgePointKey: string;
  trackSlug: string;
  stageKey: string;
  topicKey: string;
  linkSource: string;
}

export interface RelationWriteRow {
  fromKey: string;
  toKey: string;
  kind: string;
  relationSource: string;
}

export interface PrerequisiteWriteRow {
  knowledgePointKey: string;
  prerequisiteKey: string;
  relationSource: string;
}

/** 题目生命周期行（迁移 067）：内容同步只负责登记/刷新元数据，**不覆盖人工设定的 status**。 */
export interface QuestionWriteRow {
  key: string;
  trackSlug: string;
  stageKey: string;
  topicKey: string | null;
  type: string;
  difficulty: string;
  sourceKey: string | null;
  fingerprint: string;
  contentVersion: string;
}

export interface ContentSyncPlan {
  points: KnowledgePointWriteRow[];
  links: QuestionLinkWriteRow[];
  relations: RelationWriteRow[];
  prerequisites: PrerequisiteWriteRow[];
  questions: QuestionWriteRow[];
  unlinkedQuestions: string[];
  stats: KnowledgeModelStats;
  contentVersion: string;
  contentUpdatedAt: string | null;
  reviewTtlDays: number;
}

export interface BuildContentSyncPlanOptions {
  contentVersion?: string;
  contentUpdatedAt?: string | null;
  reviewTtlDays?: number;
  now?: Date;
  tracks?: LearningTrack[];
}

function addDays(base: Date, days: number): string {
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

/** 纯函数：内容包 → 待写入行（dry-run 与正式同步共用同一份结果）。 */
export function buildContentSyncPlan(options: BuildContentSyncPlanOptions = {}): ContentSyncPlan {
  const contentVersion = String(options.contentVersion ?? "unknown");
  const contentUpdatedAt = options.contentUpdatedAt ?? null;
  const reviewTtlDays = Math.max(1, Number(options.reviewTtlDays ?? DEFAULT_REVIEW_TTL_DAYS));
  const now = options.now ?? new Date();
  const tracks = options.tracks ?? learningTracks;
  const model = buildKnowledgeModel(tracks);
  // 复查基准：优先用内容包最后提交时间；拿不到就退回当前时间（并如实写进 content_updated_at 为 null）
  const reviewBase = contentUpdatedAt ? new Date(contentUpdatedAt) : now;
  const publishedAt = (contentUpdatedAt ? new Date(contentUpdatedAt) : now).toISOString();
  const staleAfter = addDays(reviewBase, reviewTtlDays);

  const points: KnowledgePointWriteRow[] = model.points.map((point) => ({
    key: point.key,
    trackSlug: point.trackSlug,
    stageKey: point.stageKey,
    topicKey: point.topicKey,
    trackTitle: point.trackTitle,
    stageTitle: point.stageTitle,
    title: point.title,
    summary: point.summary,
    sortOrder: point.sortOrder,
    stageOrder: point.stageOrder,
    topicOrder: point.topicOrder,
    status: "published",
    qualityLevel: point.qualityLevel,
    qualityMissing: point.qualityMissing,
    difficulty: point.difficulty,
    estimatedMinutes: point.estimatedMinutes,
    fingerprint: point.fingerprint,
    contentVersion,
    contentUpdatedAt,
    publishedAt,
    staleAfter,
    sourceKey: point.sourceKey,
    tags: point.tags,
  }));

  const questions: QuestionWriteRow[] = tracks.flatMap((track) =>
    track.questions.map((question) => ({
      key: question.key,
      trackSlug: track.slug,
      stageKey: question.stageKey,
      topicKey: question.topicKey ?? null,
      type: question.type,
      difficulty: question.difficulty,
      sourceKey: question.sourceKey,
      fingerprint: `${question.type}|${question.difficulty}|${question.stem}`,
      contentVersion,
    }))
  );

  return {
    points,
    links: model.questionLinks.map((link) => ({ ...link })),
    relations: model.relations.map((relation) => ({ ...relation })),
    prerequisites: model.prerequisites.map((edge) => ({ ...edge })),
    questions,
    unlinkedQuestions: model.unlinkedQuestionKeys,
    stats: model.stats,
    contentVersion,
    contentUpdatedAt,
    reviewTtlDays,
  };
}

export interface ContentSyncResult {
  inserted: number;
  updated: number;
  unchanged: number;
  archived: number;
  links: number;
  relations: number;
  prerequisites: number;
  questions: number;
  unlinkedQuestions: number;
  contentVersion: string;
  stalePoints: number;
  stats: KnowledgeModelStats;
}

const POINT_UPSERT_SQL = `
INSERT INTO knowledge_points
  (key, track_slug, stage_key, topic_key, track_title, stage_title, title, summary,
   sort_order, stage_order, topic_order, status, quality_level, quality_missing, difficulty,
   estimated_minutes, fingerprint, content_version, content_updated_at, published_at, stale_after,
   source_key, tags, deleted_at)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15,
   $16, $17, $18, $19, $20, $21, $22, $23::jsonb, NULL)
ON CONFLICT (key) DO UPDATE SET
  track_slug = EXCLUDED.track_slug,
  stage_key = EXCLUDED.stage_key,
  topic_key = EXCLUDED.topic_key,
  track_title = EXCLUDED.track_title,
  stage_title = EXCLUDED.stage_title,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  stage_order = EXCLUDED.stage_order,
  topic_order = EXCLUDED.topic_order,
  status = EXCLUDED.status,
  quality_level = EXCLUDED.quality_level,
  quality_missing = EXCLUDED.quality_missing,
  difficulty = EXCLUDED.difficulty,
  estimated_minutes = EXCLUDED.estimated_minutes,
  fingerprint = EXCLUDED.fingerprint,
  content_version = EXCLUDED.content_version,
  content_updated_at = EXCLUDED.content_updated_at,
  published_at = COALESCE(knowledge_points.published_at, EXCLUDED.published_at),
  stale_after = EXCLUDED.stale_after,
  source_key = EXCLUDED.source_key,
  tags = EXCLUDED.tags,
  deleted_at = NULL,
  updated_at = now()`;

function pointParams(point: KnowledgePointWriteRow): unknown[] {
  return [
    point.key,
    point.trackSlug,
    point.stageKey,
    point.topicKey,
    point.trackTitle,
    point.stageTitle,
    point.title,
    point.summary,
    point.sortOrder,
    point.stageOrder,
    point.topicOrder,
    point.status,
    point.qualityLevel,
    JSON.stringify(point.qualityMissing),
    point.difficulty,
    point.estimatedMinutes,
    point.fingerprint,
    point.contentVersion,
    point.contentUpdatedAt,
    point.publishedAt,
    point.staleAfter,
    point.sourceKey,
    JSON.stringify(point.tags),
  ];
}

/**
 * 把 plan 写库（单事务）。`dryRun=true` 时只回报计数、不写任何行（Phase F 的 dry-run 预览会复用）。
 */
export async function syncKnowledgeModel(
  plan: ContentSyncPlan,
  options: { dryRun?: boolean } = {}
): Promise<ContentSyncResult> {
  const client = await pgPool.connect();
  const result: ContentSyncResult = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    archived: 0,
    links: 0,
    relations: 0,
    prerequisites: 0,
    questions: 0,
    unlinkedQuestions: plan.unlinkedQuestions.length,
    contentVersion: plan.contentVersion,
    stalePoints: 0,
    stats: plan.stats,
  };
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ key: string; fingerprint: string }>(
      "SELECT key, fingerprint FROM knowledge_points"
    );
    const existing = new Map(rows.map((row) => [String(row.key), String(row.fingerprint)]));

    for (const point of plan.points) {
      const before = existing.get(point.key);
      if (before === undefined) result.inserted += 1;
      else if (before !== point.fingerprint) result.updated += 1;
      else result.unchanged += 1;
      if (options.dryRun) continue;
      await client.query(POINT_UPSERT_SQL, pointParams(point));
    }

    if (!options.dryRun) {
      const keys = plan.points.map((point) => point.key);
      // 题目生命周期：登记/刷新元数据；人工设定的 status（draft/review/archived）不被同步覆盖。
      if (plan.questions.length > 0) {
        const upserted = await client.query(
          `INSERT INTO learning_questions
             (key, track_slug, stage_key, topic_key, type, difficulty, source_key, fingerprint, content_version)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
                                $6::text[], $7::text[], $8::text[], $9::text[])
           ON CONFLICT (key) DO UPDATE SET
             track_slug = EXCLUDED.track_slug,
             stage_key = EXCLUDED.stage_key,
             topic_key = EXCLUDED.topic_key,
             type = EXCLUDED.type,
             difficulty = EXCLUDED.difficulty,
             source_key = EXCLUDED.source_key,
             fingerprint = EXCLUDED.fingerprint,
             content_version = EXCLUDED.content_version,
             updated_at = now()`,
          [
            plan.questions.map((question) => question.key),
            plan.questions.map((question) => question.trackSlug),
            plan.questions.map((question) => question.stageKey),
            plan.questions.map((question) => question.topicKey),
            plan.questions.map((question) => question.type),
            plan.questions.map((question) => question.difficulty),
            plan.questions.map((question) => question.sourceKey),
            plan.questions.map((question) => question.fingerprint),
            plan.questions.map((question) => question.contentVersion),
          ]
        );
        result.questions = upserted.rowCount ?? 0;
      }

      // 只归档**内容包管的 published 行**：draft / review 是人工或导入的暂存稿，
      // 内容包里没有它们不代表"内容消失"，不能顺手归档（否则草稿区每同步一次就被清空）。
      const archived = await client.query(
        `UPDATE knowledge_points
            SET status = 'archived', updated_at = now()
          WHERE status = 'published' AND NOT (key = ANY($1::text[]))`,
        [keys]
      );
      result.archived = archived.rowCount ?? 0;

      // 关联行只重写 derived：人工审定的 curated 边保留
      await client.query("DELETE FROM question_knowledge_point WHERE link_source <> 'curated'");
      await client.query("DELETE FROM knowledge_relation WHERE relation_source = 'derived'");
      await client.query("DELETE FROM knowledge_prerequisite WHERE relation_source = 'derived'");

      if (plan.links.length > 0) {
        const inserted = await client.query(
          `INSERT INTO question_knowledge_point
             (question_key, knowledge_point_key, track_slug, stage_key, topic_key, link_source)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
           ON CONFLICT DO NOTHING`,
          [
            plan.links.map((link) => link.questionKey),
            plan.links.map((link) => link.knowledgePointKey),
            plan.links.map((link) => link.trackSlug),
            plan.links.map((link) => link.stageKey),
            plan.links.map((link) => link.topicKey),
            plan.links.map((link) => link.linkSource),
          ]
        );
        result.links = inserted.rowCount ?? 0;
      }

      if (plan.relations.length > 0) {
        const inserted = await client.query(
          `INSERT INTO knowledge_relation (from_key, to_key, kind, relation_source)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
           ON CONFLICT DO NOTHING`,
          [
            plan.relations.map((relation) => relation.fromKey),
            plan.relations.map((relation) => relation.toKey),
            plan.relations.map((relation) => relation.kind),
            plan.relations.map((relation) => relation.relationSource),
          ]
        );
        result.relations = inserted.rowCount ?? 0;
      }

      if (plan.prerequisites.length > 0) {
        const inserted = await client.query(
          `INSERT INTO knowledge_prerequisite (knowledge_point_key, prerequisite_key, relation_source)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
           ON CONFLICT DO NOTHING`,
          [
            plan.prerequisites.map((edge) => edge.knowledgePointKey),
            plan.prerequisites.map((edge) => edge.prerequisiteKey),
            plan.prerequisites.map((edge) => edge.relationSource),
          ]
        );
        result.prerequisites = inserted.rowCount ?? 0;
      }

      const stale = await client.query(
        `SELECT count(*)::int AS n FROM knowledge_points
          WHERE status = 'published' AND stale_after IS NOT NULL AND stale_after < now()`
      );
      result.stalePoints = Number(stale.rows[0]?.n ?? 0);
    }

    if (options.dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 内容包版本：`packages/content/src/learning` 的最后一次 git 提交时间 + 短 sha。
 * 拿不到 git（例如打包环境）时返回 unknowns，调用方据此写入 'unknown'，不编造日期。
 */
export function readContentPackageVersion(cwd: string = resolveContentRepoRoot()): {
  version: string;
  updatedAt: string | null;
} {
  try {
    const raw = execFileSync(
      "git",
      ["log", "-1", "--format=%cI%n%h", "--", "packages/content/src/learning"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    const [updatedAt, sha] = raw.split(/\r?\n/);
    if (!updatedAt || !sha) return { version: "unknown", updatedAt: null };
    return { version: sha.slice(0, 12), updatedAt: new Date(updatedAt).toISOString() };
  } catch {
    return { version: "unknown", updatedAt: null };
  }
}
