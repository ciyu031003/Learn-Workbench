/**
 * 学习内容全量落库（075）：packages/content → 数据库。
 *
 * 分工：
 *   - `buildLearningContentPlan()`：**纯函数**（内容包 `learningTracks` → 待写入行），可单测、可 dry-run；
 *   - `syncLearningContent()`：把 plan 写进库（单事务、幂等、可重复跑），并回报各表写入行数。
 *
 * 幂等 / 安全口径：
 *   - 所有表按稳定主键 upsert；`status` 永远不参与 UPDATE —— 人工设定的
 *     draft/review/archived（下架一道题、下线一个知识点）不会被内容同步冲掉；
 *   - 内容包里已消失、且仍是 published 的行 → 软归档 archived（不物理删，历史作答/复习卡仍可追溯）；
 *   - dry-run 只构建 plan，不写库。
 */
import { createHash } from "node:crypto";
import { algorithmAnimations, learningTracks, levelOfQuestion, type LearningTrack } from "@learn-workbench/content";
import type { PoolClient } from "pg";
import { pgPool } from "@/lib/db";

export interface LearningContentPlan {
  contentVersion: string;
  /** 仓库内容包指纹（S7-4b：随同步写入 content_meta，供 content-freshness 门禁比对） */
  contentFingerprint?: string;
  tracks: Record<string, unknown>[];
  stages: Record<string, unknown>[];
  topics: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  questions: Record<string, unknown>[];
  animations: Record<string, unknown>[];
  counts: Record<string, number>;
}

export interface LearningContentSyncResult {
  contentVersion: string;
  dryRun: boolean;
  tracks: number;
  stages: number;
  topics: number;
  sources: number;
  questions: number;
  animations: number;
  archived: { tracks: number; topics: number; questions: number };
  /** 因「后台人工编辑过」而被跳过的行数（076） */
  preserved: { topics: number; questions: number };
}

function fingerprintOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

/** 纯函数：把内容包拍平成各表待写入行（顺序即展示顺序）。 */
export function buildLearningContentPlan(
  tracks: readonly LearningTrack[] = learningTracks,
  contentVersion = "unknown",
  contentFingerprint?: string
): LearningContentPlan {
  const plan: LearningContentPlan = {
    contentVersion,
    contentFingerprint: contentFingerprint || undefined,
    tracks: [],
    stages: [],
    topics: [],
    sources: [],
    questions: [],
    animations: [],
    counts: {},
  };

  tracks.forEach((track, trackIndex) => {
    plan.tracks.push({
      slug: track.slug,
      title: track.title,
      category: track.category,
      level: track.level,
      accent: track.accent,
      soft_accent: track.softAccent,
      icon: track.icon,
      summary: track.summary,
      why_learn: track.whyLearn,
      prerequisites: JSON.stringify(track.prerequisites ?? []),
      study_method: JSON.stringify(track.studyMethod ?? []),
      estimated_hours: track.estimatedHours,
      featured: track.featured,
      sort_order: trackIndex,
      status: "published",
      content_version: contentVersion,
      fingerprint: fingerprintOf([track.title, track.summary, track.whyLearn, track.stages.length]),
    });

    track.sources.forEach((source, i) => {
      plan.sources.push({
        track_slug: track.slug,
        key: source.key,
        name: source.name,
        url: source.url,
        license: source.license,
        usage: source.usage,
        note: source.note,
        sort_order: i,
      });
    });

    let topicOrdinal = 0;
    track.stages.forEach((stage, stageIndex) => {
      plan.stages.push({
        track_slug: track.slug,
        key: stage.key,
        title: stage.title,
        weeks: stage.weeks,
        goal: stage.goal,
        outcome: stage.outcome,
        lesson: stage.lesson ? JSON.stringify(stage.lesson) : null,
        sort_order: stageIndex,
      });
      stage.topics.forEach((topic) => {
        plan.topics.push({
          track_slug: track.slug,
          key: topic.key,
          stage_key: stage.key,
          title: topic.title,
          summary: topic.summary,
          concepts: JSON.stringify(topic.concepts ?? []),
          principles: JSON.stringify(topic.principles ?? []),
          applications: JSON.stringify(topic.applications ?? []),
          pitfalls: JSON.stringify(topic.pitfalls ?? []),
          method: topic.method,
          exercise: topic.exercise,
          checkpoint: topic.checkpoint,
          lesson: topic.lesson ? JSON.stringify(topic.lesson) : null,
          animations: JSON.stringify(topic.animations ?? []),
          sort_order: topicOrdinal++,
          status: "published",
          // 内容包同步进来的行：受软归档管辖；库里新增的行 origin='db'，同步不动它们（077）
          origin: "package",
          fingerprint: fingerprintOf([topic.title, topic.summary, topic.method, topic.exercise, topic.checkpoint, topic.lesson ?? null]),
        });
      });
    });

    track.questions.forEach((question, i) => {
      plan.questions.push({
        key: question.key,
        track_slug: track.slug,
        stage_key: question.stageKey,
        topic_key: question.topicKey ?? null,
        type: question.type,
        difficulty: question.difficulty,
        source_key: question.sourceKey,
        content_version: contentVersion,
        fingerprint: fingerprintOf([question.stem, question.options, question.answer, question.explanation]),
        stem: question.stem,
        options: JSON.stringify(question.options ?? []),
        answer: JSON.stringify(question.answer ?? []),
        explanation: question.explanation,
        tags: JSON.stringify(question.tags ?? []),
        level: levelOfQuestion(question),
        sort_order: i,
      });
    });
  });

  for (const [key, frames] of Object.entries(algorithmAnimations ?? {})) {
    plan.animations.push({ key, frames: JSON.stringify(frames) });
  }

  plan.counts = {
    tracks: plan.tracks.length,
    stages: plan.stages.length,
    topics: plan.topics.length,
    sources: plan.sources.length,
    questions: plan.questions.length,
    animations: plan.animations.length,
  };
  return plan;
}

const JSON_COLUMNS = new Set([
  "prerequisites", "study_method", "lesson", "concepts", "principles", "applications",
  "pitfalls", "animations", "options", "answer", "tags", "frames",
]);
const INT_COLUMNS = new Set(["estimated_hours", "sort_order"]);
const BOOL_COLUMNS = new Set(["featured"]);

/** 单条多行 INSERT：所有行按列 unnest 进同一个语句，避免 N 次往返。 */
async function upsertRows(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  conflictColumns: string[],
  updateColumns: string[],
  preserveWhere?: string
): Promise<void> {
  if (rows.length === 0) return;
  const arrays = columns.map((column) => rows.map((row) => row[column] ?? null));
  const castList = columns
    .map((column, i) => {
      const base = JSON_COLUMNS.has(column) ? "jsonb" : INT_COLUMNS.has(column) ? "int" : BOOL_COLUMNS.has(column) ? "boolean" : "text";
      return "$" + (i + 1) + "::" + base + "[]";
    })
    .join(", ");
  const updateSet = updateColumns.map((column) => column + " = EXCLUDED." + column).join(", ");
  const preserve = preserveWhere ? " WHERE " + preserveWhere : "";
  const sql =
    "INSERT INTO " + table + " (" + columns.join(", ") + ") " +
    "SELECT * FROM unnest(" + castList + ") " +
    (updateSet
      ? "ON CONFLICT (" + conflictColumns.join(", ") + ") DO UPDATE SET " + updateSet + preserve
      : "ON CONFLICT (" + conflictColumns.join(", ") + ") DO NOTHING");
  await client.query(sql, arrays);
}

/** 把 plan 写进库（单事务、幂等）。dryRun 时不写。 */
export async function syncLearningContent(
  plan: LearningContentPlan,
  options: { dryRun?: boolean; force?: boolean } = {}
): Promise<LearningContentSyncResult> {
  const dryRun = options.dryRun === true;
  const result: LearningContentSyncResult = {
    contentVersion: plan.contentVersion,
    dryRun,
    tracks: plan.tracks.length,
    stages: plan.stages.length,
    topics: plan.topics.length,
    sources: plan.sources.length,
    questions: plan.questions.length,
    animations: plan.animations.length,
    archived: { tracks: 0, topics: 0, questions: 0 },
    preserved: { topics: 0, questions: 0 },
  };
  if (dryRun) return result;

  // 安全闸：内容计划为空（内容包加载异常等）时拒绝写库，
  // 否则下面的「软归档」会把库里全部内容标成 archived。
  if (plan.tracks.length === 0 || plan.questions.length === 0) {
    throw new Error("学习内容计划为空，拒绝同步（避免误归档全部内容）");
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // force：显式以内容包为准 —— 先清掉人工编辑标记，让下面的 upsert 能覆盖
    if (options.force) {
      await client.query("UPDATE learning_questions SET manually_edited_at = NULL WHERE key = ANY($1::text[])", [plan.questions.map((row) => row.key)]);
      await client.query(
        "UPDATE learning_topics SET manually_edited_at = NULL WHERE (track_slug || '::' || key) = ANY($1::text[])",
        [plan.topics.map((row) => row.track_slug + "::" + row.key)]
      );
    }

    await upsertRows(
      client, "learning_tracks",
      ["slug","title","category","level","accent","soft_accent","icon","summary","why_learn","prerequisites","study_method","estimated_hours","featured","sort_order","status","content_version","fingerprint"],
      plan.tracks, ["slug"],
      ["title","category","level","accent","soft_accent","icon","summary","why_learn","prerequisites","study_method","estimated_hours","featured","sort_order","content_version","fingerprint"]
    );
    await upsertRows(
      client, "learning_stages",
      ["track_slug","key","title","weeks","goal","outcome","lesson","sort_order"],
      plan.stages, ["track_slug","key"],
      ["title","weeks","goal","outcome","lesson","sort_order"]
    );
    await upsertRows(
      client, "learning_topics",
      ["track_slug","key","stage_key","title","summary","concepts","principles","applications","pitfalls","method","exercise","checkpoint","lesson","animations","sort_order","status","fingerprint","origin"],
      plan.topics, ["track_slug","key"],
      ["stage_key","title","summary","concepts","principles","applications","pitfalls","method","exercise","checkpoint","lesson","animations","sort_order","fingerprint","origin"],
      // 后台改过的知识点不再被内容包覆盖（076）
      "learning_topics.manually_edited_at IS NULL"
    );
    await upsertRows(
      client, "learning_sources",
      ["track_slug","key","name","url","license","usage","note","sort_order"],
      plan.sources, ["track_slug","key"],
      ["name","url","license","usage","note","sort_order"]
    );
    await upsertRows(
      client, "learning_animations",
      ["key","frames"],
      plan.animations, ["key"],
      ["frames"]
    );
    await upsertRows(
      client, "learning_questions",
      ["key","track_slug","stage_key","topic_key","type","difficulty","source_key","content_version","fingerprint","stem","options","answer","explanation","tags","level","sort_order"],
      plan.questions, ["key"],
      ["track_slug","stage_key","topic_key","type","difficulty","source_key","content_version","fingerprint","stem","options","answer","explanation","tags","level","sort_order"],
      // 后台改过的题目不再被内容包覆盖（076）
      "learning_questions.manually_edited_at IS NULL"
    );

    // 软归档：内容包已消失、且仍是 published 的行
    const trackSlugs = plan.tracks.map((row) => row.slug as string);
    const topicKeys = plan.topics.map((row) => row.track_slug + "::" + row.key);
    const questionKeys = plan.questions.map((row) => row.key as string);

    const archivedTracks = await client.query(
      "UPDATE learning_tracks SET status = 'archived' WHERE status = 'published' AND NOT (slug = ANY($1::text[]))",
      [trackSlugs]
    );
    const archivedTopics = await client.query(
      // 只归档「来自内容包」的行；库里新增（origin='db'）的知识点不归同步管（077）
      "UPDATE learning_topics SET status = 'archived' WHERE status = 'published' AND origin = 'package' AND NOT ((track_slug || '::' || key) = ANY($1::text[]))",
      [topicKeys]
    );
    // 题目：内容包里删掉的题，或整门课消失后遗留的孤儿题，都软归档
    const archivedQuestions = await client.query(
      "UPDATE learning_questions SET status = 'archived' WHERE status = 'published' AND (NOT (track_slug = ANY($1::text[])) OR NOT (key = ANY($2::text[])))",
      [trackSlugs, questionKeys]
    );
    result.archived = {
      tracks: archivedTracks.rowCount ?? 0,
      topics: archivedTopics.rowCount ?? 0,
      questions: archivedQuestions.rowCount ?? 0,
    };

    // 人工编辑保护命中多少行（077 起同步会跳过它们）
    const preservedQuestions = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM learning_questions WHERE manually_edited_at IS NOT NULL AND key = ANY($1::text[])",
      [questionKeys]
    );
    const preservedTopics = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM learning_topics WHERE manually_edited_at IS NOT NULL AND (track_slug || '::' || key) = ANY($1::text[])",
      [topicKeys]
    );
    result.preserved = {
      questions: preservedQuestions.rows[0]?.n ?? 0,
      topics: preservedTopics.rows[0]?.n ?? 0,
    };

    // S7-4b：内容版本 marker（content-freshness 门禁读取）。
    // 082 之前的库没有 content_meta 表 → 先探测再写，绝不阻断同步（滚动发布/旧库兼容）。
    const metaTable = await client.query<{ table: string | null }>(
      "SELECT to_regclass('public.content_meta')::text AS table"
    );
    if (metaTable.rows[0]?.table) {
      const metaKeys: string[] = [];
      const metaValues: string[] = [];
      if (plan.contentVersion && plan.contentVersion !== "unknown") {
        metaKeys.push("content_version");
        metaValues.push(plan.contentVersion);
      }
      if (plan.contentFingerprint) {
        metaKeys.push("content_fingerprint");
        metaValues.push(plan.contentFingerprint);
      }
      if (metaKeys.length > 0) {
        metaKeys.push("content_synced_at");
        metaValues.push(new Date().toISOString());
        await client.query(
          `INSERT INTO content_meta (key, value)
           SELECT * FROM unnest($1::text[], $2::text[])
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [metaKeys, metaValues]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return result;
}
