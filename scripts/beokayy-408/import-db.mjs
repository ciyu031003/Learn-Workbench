#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED,
  ORIGIN,
  parseArgs,
  readJson,
  resolveOutDir,
  sha1,
  sha256,
  writeJson,
} from "./common.mjs";
import {
  batchStatusFromCounts,
  buildSnapshotImportPlan,
  withSnapshotStatus,
} from "./plan.mjs";

const BASELINE = JSON.parse(
  await readFile(new URL("./baseline.json", import.meta.url), "utf8"),
);
const require = createRequire(import.meta.url);
const SOURCE_KEY = "beokayy-408";
const KEY_PREFIX = "beokayy-408";
const TYPE_LABELS = {
  choice: "选择题",
  comprehensive: "综合应用题",
};

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolveOutDir(args);
const APPLY = Boolean(args.apply);
const PUBLISH = Boolean(args.publish);
const MATERIALIZED_STATUS = PUBLISH ? "published" : "review";

function loadPg() {
  try {
    return require("pg");
  } catch {}

  const candidates = [
    path.join(process.cwd(), "apps", "web", "node_modules", "pg"),
    path.join(process.cwd(), "node_modules", "pg"),
    path.join(process.cwd(), "..", "apps", "web", "node_modules", "pg"),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }
  throw new Error(
    "Unable to load pg. Run pnpm install so apps/web dependencies are available.",
  );
}

async function main() {
  if (PUBLISH && !APPLY) {
    throw new Error("--publish is only valid together with --apply");
  }

  const manifestFile = path.join(OUT_DIR, "raw", "manifest.json");
  const [manifest, papersFile, questionsFile, knowledgeFile, manifestBytes] =
    await Promise.all([
      readJson(manifestFile),
      readJson(path.join(OUT_DIR, "parsed", "papers.json")),
      readJson(path.join(OUT_DIR, "parsed", "questions.json")),
      readJson(path.join(OUT_DIR, "parsed", "knowledge-index.json")),
      readFile(manifestFile),
    ]);

  const model = buildImportModel({
    manifest,
    papers: papersFile.papers ?? [],
    questions: questionsFile.questions ?? [],
    subjects: knowledgeFile.subjects ?? [],
    bundleUrl: questionsFile.source?.bundleUrl ?? manifest.discovery?.bundleUrl,
    bundleSha256: questionsFile.source?.bundleSha256,
    manifestSha256: sha256(manifestBytes),
  });

  validateModel(model);
  const materializedModel = withSnapshotStatus(model, MATERIALIZED_STATUS);

  const database = {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: String(args.database ?? process.env.PGDATABASE ?? "Learn-Workbench"),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
  };

  const { Pool } = loadPg();
  const pool = new Pool({
    ...database,
    connectionTimeoutMillis: 5000,
    max: 2,
  });

  const client = await pool.connect();
  let dbCounts = null;
  try {
    await assertSchema(client);

    await client.query("BEGIN");
    try {
      const batch = await recordSnapshotImportBatch(client, materializedModel, {
        apply: APPLY,
        publish: PUBLISH,
      });
      if (APPLY && batch.materialize) {
        await writeModel(client, materializedModel, { publish: PUBLISH });
        dbCounts = await readDatabaseCounts(client);
        validateDatabaseCounts(dbCounts, materializedModel);
      }
      await client.query("COMMIT");
      reportBatch = {
        batchId: batch.batchId,
        status: batch.status,
        counts: batch.plan.counts,
        stale: batch.plan.stale,
        materialized: batch.materialize,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }

  const report = {
    version: 1,
    mode: APPLY ? "apply" : "dry-run",
    importedAt: new Date().toISOString(),
    database: {
      host: database.host,
      port: database.port,
      database: database.database,
      user: database.user,
    },
    source: model.source,
    planned: model.counts,
    databaseCounts: dbCounts,
    batch: reportBatch,
    materializedStatus: MATERIALIZED_STATUS,
    materialized: reportBatch?.materialized ?? false,
    publish: PUBLISH,
  };
  await writeJson(path.join(OUT_DIR, "db-import-report.json"), report);

  console.log(
    [
      `[beokayy-408] db import ${APPLY ? "applied" : "dry-run"}`,
      `database=${database.database}`,
      `subjects=${model.counts.subjects}`,
      `chapters=${model.counts.chapters}`,
      `points=${model.counts.points}`,
      `papers=${model.counts.papers}`,
      `questions=${model.counts.questions}`,
      `links=${model.counts.questionKnowledgeLinks}`,
      `tags=${model.counts.tags}`,
      `batch=${reportBatch?.batchId ?? "none"}`,
      `status=${reportBatch?.status ?? "unknown"}`,
      `materialized=${reportBatch?.materialized === true ? MATERIALIZED_STATUS : "no"}`,
    ].join(" "),
  );
}

let reportBatch = null;

function buildImportModel(input) {
  const tags = new TagRegistry();
  const sourceTag = tags.add("source", SOURCE_KEY, "四〇八档案室");
  const examTag = tags.add("exam", "408", "408");

  const subjectRows = [];
  const chapterRows = [];
  const pointRows = [];
  const pointTagLinks = new Set();
  const questionKnowledgeLinks = new Map();
  const pointBySiteKey = new Map();
  const subjectLabelToKey = new Map();

  input.subjects.forEach((subject, subjectIndex) => {
      const subjectKey = prefixed(subject.key);
      const subjectTag = tags.add("subject", subject.key, subject.label);
      subjectLabelToKey.set(subject.label, subjectKey);
      subjectRows.push({
        key: subjectKey,
        source_key: SOURCE_KEY,
        short_name: subject.short,
        title: subject.label,
        sort_order: subjectIndex,
      });

      let pointSortOrder = 0;
      for (const chapter of subject.chapters) {
        const chapterKey = prefixed(chapter.key);
        const chapterTag = tags.add("chapter", chapter.key, chapter.title);
        const chapterQuestionIds = new Set();
        chapterRows.push({
          key: chapterKey,
          source_key: SOURCE_KEY,
          subject_key: subjectKey,
          chapter_number: chapter.number,
          title: chapter.title,
          sort_order: chapter.number - 1,
          question_count: 0,
          source_url: subject.sourceUrl,
        });

        for (const point of chapter.points) {
          const pointKey = prefixed(point.key);
          const pointTag = tags.add("knowledge-point", point.key, point.title);
          const pointNumber = Number(point.key.split("-").at(-1));
          const uniqueQuestionIds = [...new Set(point.questionIds)];
          const derivedTags = [
            sourceTag,
            examTag,
            subjectTag,
            chapterTag,
            pointTag,
          ];

          pointRows.push({
            key: pointKey,
            source_key: SOURCE_KEY,
            subject_key: subjectKey,
            chapter_key: chapterKey,
            point_number: pointNumber,
            title: point.title,
            summary: `${subject.label} · ${chapter.title}`,
            sort_order: pointSortOrder++,
            question_count: uniqueQuestionIds.length,
            tags: uniqueStrings(derivedTags.map((tag) => tag.name)),
            source_url: subject.sourceUrl,
            fingerprint: fingerprint({
              key: pointKey,
              title: point.title,
              subjectKey,
              chapterKey,
              questionIds: uniqueQuestionIds,
            }),
            status: "published",
          });

          pointBySiteKey.set(point.key, {
            key: pointKey,
            row: pointRows.at(-1),
            tagKeys: derivedTags.map((tag) => tag.key),
          });

          for (const questionId of uniqueQuestionIds) {
            const questionKey = prefixed(questionId);
            const mappingKey = `${questionKey}\0${pointKey}`;
            questionKnowledgeLinks.set(mappingKey, {
              question_key: questionKey,
              knowledge_point_key: pointKey,
              link_source: "explicit",
            });
            chapterQuestionIds.add(questionId);
          }
        }

        chapterRows.at(-1).question_count = chapterQuestionIds.size;
      }
    });

  const questionRows = [];
  const questionTagLinks = new Set();
  for (const question of input.questions) {
    const subjectKey = subjectLabelToKey.get(question.subject);
    if (!subjectKey) {
      throw new Error(
        `Question ${question.id} has no matching subject: ${question.subject}`,
      );
    }

    const questionKey = prefixed(question.id);
    const subjectTag = tags.add(
      "subject",
      subjectKey.split("/").at(-1),
      question.subject,
    );
    const yearTag = tags.add("year", String(question.year), String(question.year));
    const typeTag = tags.add(
      "question-type",
      question.type,
      TYPE_LABELS[question.type] ?? question.type,
    );
    const sourceTags = uniqueStrings(question.tags ?? []);
    const rawTags = sourceTags.map((tag) =>
      tags.add("raw", `raw-${sha1(normalizeTag(tag)).slice(0, 16)}`, tag),
    );
    const linkedPointTags = [...questionKnowledgeLinks.values()]
      .filter((link) => link.question_key === questionKey)
      .map((link) => pointBySiteKey.get(link.knowledge_point_key.split("/").at(-1)))
      .filter(Boolean)
      .flatMap((point) => point.tagKeys.map((key) => tags.getByKey(key)));
    const derivedTags = [
      sourceTag,
      examTag,
      subjectTag,
      yearTag,
      typeTag,
      ...rawTags,
      ...linkedPointTags,
    ].filter(Boolean);

    questionRows.push({
      key: questionKey,
      source_key: SOURCE_KEY,
      paper_year: question.year,
      question_id: question.id,
      question_number: question.number,
      type: question.type,
      subject_key: subjectKey,
      points: question.points,
      body: question.body,
      stem: question.stem,
      options: question.options,
      answer_text: question.answerText,
      answer_letter: question.answerLetter,
      image_refs: question.imageRefs,
      answer_image_refs: question.answerImageRefs,
      has_image: question.hasImage,
      video_url: question.videoUrl,
      video_p_offset: question.videoPOffset,
      missing_fields: question.missingFields,
      source_tags: sourceTags,
      tags: uniqueStrings(derivedTags.map((tag) => tag.name)),
      source_url: question.sourceUrl,
      fingerprint: fingerprint({
        key: questionKey,
        body: question.body,
        options: question.options,
        answerText: question.answerText,
        imageRefs: question.imageRefs,
        tags: question.tags,
      }),
      status: "published",
    });

    for (const tag of derivedTags) {
      questionTagLinks.add(
        JSON.stringify([questionKey, tag.key]),
      );
    }
  }

  const paperRows = input.papers.map((paper) => ({
    year: paper.year,
    source_key: SOURCE_KEY,
    title: paper.title,
    total_score: paper.totalScore,
    question_count: paper.questionIds.length,
    source_url: `${ORIGIN}/paper/${paper.year}`,
    captured_at: input.manifest.capturedAt,
    fingerprint: fingerprint({
      year: paper.year,
      questionIds: paper.questionIds,
      totalScore: paper.totalScore,
    }),
    status: "published",
  }));

  for (const point of pointRows) {
    for (const tagKey of pointBySiteKey.get(point.key.split("/").at(-1)).tagKeys) {
      pointTagLinks.add(JSON.stringify([point.key, tagKey]));
    }
  }

  const questionKnowledgeRows = [...questionKnowledgeLinks.values()].sort(
    (left, right) =>
      left.question_key.localeCompare(right.question_key) ||
      left.knowledge_point_key.localeCompare(right.knowledge_point_key),
  );
  const questionTagRows = [...questionTagLinks]
    .map((value) => {
      const [question_key, tag_key] = JSON.parse(value);
      return { question_key, tag_key };
    })
    .sort(
      (left, right) =>
        left.question_key.localeCompare(right.question_key) ||
        left.tag_key.localeCompare(right.tag_key),
    );
  const pointTagRows = [...pointTagLinks]
    .map((value) => {
      const [knowledge_point_key, tag_key] = JSON.parse(value);
      return { knowledge_point_key, tag_key };
    })
    .sort(
      (left, right) =>
        left.knowledge_point_key.localeCompare(right.knowledge_point_key) ||
        left.tag_key.localeCompare(right.tag_key),
    );
  const tagRows = tags.rows().map((tag) => ({
    ...tag,
    source_key: SOURCE_KEY,
  }));

  const source = {
    key: SOURCE_KEY,
    name: "四〇八档案室 · 408 历年真题",
    base_url: ORIGIN,
    license_note:
      "站点未声明开源或转载许可；仅个人、非商业、本地学习使用，不再分发。",
    usage_scope: "personal-study",
    captured_at: input.manifest.capturedAt,
    bundle_url: input.bundleUrl ?? null,
    bundle_sha256: input.bundleSha256 ?? null,
    manifest_sha256: input.manifestSha256,
    note: "2009-2026 年 408 试卷、知识点索引、题目和标签快照。",
  };

  return {
    source,
    subjects: subjectRows,
    chapters: chapterRows,
    points: pointRows,
    papers: paperRows,
    questions: questionRows,
    tags: tagRows,
    questionKnowledgeLinks: questionKnowledgeRows,
    questionTagLinks: questionTagRows,
    pointTagLinks: pointTagRows,
    counts: {
      subjects: subjectRows.length,
      chapters: chapterRows.length,
      points: pointRows.length,
      papers: paperRows.length,
      questions: questionRows.length,
      questionKnowledgeLinks: questionKnowledgeRows.length,
      tags: tagRows.length,
      questionTagLinks: questionTagRows.length,
      pointTagLinks: pointTagRows.length,
    },
  };
}

function validateModel(model) {
  if (model.counts.subjects < BASELINE.minimum.subjects) {
    throw new Error(
      `Expected at least ${BASELINE.minimum.subjects} subjects, got ${model.counts.subjects}.`,
    );
  }
  if (model.counts.papers < BASELINE.minimum.papers) {
    throw new Error(
      `Expected at least ${BASELINE.minimum.papers} papers, got ${model.counts.papers}.`,
    );
  }
  if (model.counts.questions < BASELINE.minimum.questions) {
    throw new Error(
      `Expected at least ${BASELINE.minimum.questions} questions, got ${model.counts.questions}.`,
    );
  }

  const invalidChoices = model.questions.filter(
    (question) =>
      question.type === "choice" &&
      (question.options.length !== 4 || !question.answer_letter),
  );
  if (invalidChoices.length > 0) {
    throw new Error(
      `${invalidChoices.length} choice questions have incomplete options or answers.`,
    );
  }
}

async function assertSchema(client) {
  const { rows } = await client.query(
    `SELECT
       to_regclass('public.exam_408_source_snapshots') AS source,
       to_regclass('public.exam_408_questions') AS questions,
       to_regclass('public.exam_408_tags') AS tags`,
  );
  if (!rows[0]?.source || !rows[0]?.questions || !rows[0]?.tags) {
    throw new Error(
      "The exam_408_* tables are missing. Apply db/migrations/071_exam_408_content.sql first.",
    );
  }
}

async function recordSnapshotImportBatch(client, model, { apply, publish }) {
  const source = await client.query(
    `SELECT key FROM content_source WHERE key = $1 AND status = 'active'`,
    [model.source.key],
  );
  if (!source.rows[0]) {
    throw new Error(
      "content_source does not contain an active beokayy-408 row; apply db/migrations/072_exam_408_import_audit.sql first.",
    );
  }

  const existing = {
    points: (
      await client.query(
        `SELECT key, status, fingerprint
           FROM exam_408_knowledge_points
          WHERE source_key = $1`,
        [model.source.key],
      )
    ).rows,
    questions: (
      await client.query(
        `SELECT key, status, fingerprint
           FROM exam_408_questions
          WHERE source_key = $1`,
        [model.source.key],
      )
    ).rows,
  };
  const plan = buildSnapshotImportPlan({ existing, model, publish });
  const status = batchStatusFromCounts(plan.counts);
  // A conflict means the source changed something already published. Do not
  // touch any content rows in that run; the batch is the review artifact.
  const materialize = apply && plan.counts.conflict === 0 && plan.counts.failed === 0;
  const mode = apply ? "apply" : "dry-run";
  const commitSha = model.source.bundle_sha256
    ? `bundle:${model.source.bundle_sha256}`
    : null;
  const scope = (model.subjects ?? []).map((subject) => subject.key);

  const batchResult = await client.query(
    `INSERT INTO content_import_batch
       (source_key, mode, status, commit_sha, scope, planned_new, planned_update,
        planned_skip, planned_conflict, planned_failed, created_by)
     VALUES ($1, $2, 'running', $3, $4::jsonb, $5, $6, $7, $8, $9, 'beokayy-408-import')
     RETURNING id`,
    [
      model.source.key,
      mode,
      commitSha,
      JSON.stringify(scope),
      plan.counts.new,
      plan.counts.update,
      plan.counts.skip,
      plan.counts.conflict,
      plan.counts.failed,
    ],
  );
  const batchId = Number(batchResult.rows[0].id);

  const payloadByKey = new Map();
  for (const point of model.points ?? []) {
    payloadByKey.set(`knowledge-point:${point.key}`, {
      fingerprint: point.fingerprint,
      status: point.status,
      subjectKey: point.subject_key,
      chapterKey: point.chapter_key,
      title: point.title,
    });
  }
  for (const question of model.questions ?? []) {
    payloadByKey.set(`question:${question.key}`, {
      fingerprint: question.fingerprint,
      status: question.status,
      questionId: question.question_id,
      subjectKey: question.subject_key,
      type: question.type,
      answerLetter: question.answer_letter,
    });
  }

  const itemRows = plan.items.map((item) => [
    item.kind,
    item.externalKey,
    item.targetKey,
    item.action,
    item.reason,
    JSON.stringify(payloadByKey.get(`${item.kind}:${item.externalKey}`) ?? {}),
  ]);
  for (let index = 0; index < itemRows.length; index += 500) {
    const chunk = itemRows.slice(index, index + 500);
    await client.query(
      `INSERT INTO content_import_item
         (batch_id, kind, external_key, target_key, action, reason, payload)
       SELECT $1, * FROM unnest(
         $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::jsonb[]
       )
       ON CONFLICT (batch_id, kind, external_key) DO UPDATE SET
         target_key = EXCLUDED.target_key,
         action = EXCLUDED.action,
         reason = EXCLUDED.reason,
         payload = EXCLUDED.payload`,
      [
        batchId,
        chunk.map((row) => row[0]),
        chunk.map((row) => row[1]),
        chunk.map((row) => row[2]),
        chunk.map((row) => row[3]),
        chunk.map((row) => row[4]),
        chunk.map((row) => row[5]),
      ],
    );
  }

  const report = {
    domain: "exam-408",
    sourceKey: model.source.key,
    capturedAt: model.source.captured_at,
    bundleSha256: model.source.bundle_sha256,
    manifestSha256: model.source.manifest_sha256,
    mode,
    status,
    materializedStatus: publish ? "published" : "review",
    materialized: materialize,
    counts: plan.counts,
    stale: {
      points: plan.stale.points.length,
      questions: plan.stale.questions.length,
      sample: [...plan.stale.points.slice(0, 20), ...plan.stale.questions.slice(0, 20)],
    },
  };

  await client.query(
    `UPDATE content_import_batch
        SET status = $2,
            applied_new = $3,
            applied_update = $4,
            applied_skipped = $5,
            report = $6::jsonb,
            finished_at = now()
      WHERE id = $1`,
    [
      batchId,
      status,
      materialize ? plan.counts.new : 0,
      materialize ? plan.counts.update : 0,
      plan.counts.skip,
      JSON.stringify(report),
    ],
  );
  if (materialize) {
    await client.query(
      `UPDATE content_source
          SET last_synced_at = now(),
              commit_sha = COALESCE($2, commit_sha)
        WHERE key = $1`,
      [model.source.key, commitSha],
    );
  }

  return { batchId, status, plan, materialize };
}

async function writeModel(client, model, options = {}) {
  const preservePublished = options.publish !== true;
  await client.query(
    `INSERT INTO exam_408_source_snapshots (
       key, name, base_url, license_note, usage_scope, captured_at,
       bundle_url, bundle_sha256, manifest_sha256, note
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (key) DO UPDATE SET
       name = EXCLUDED.name,
       base_url = EXCLUDED.base_url,
       license_note = EXCLUDED.license_note,
       usage_scope = EXCLUDED.usage_scope,
       captured_at = EXCLUDED.captured_at,
       bundle_url = EXCLUDED.bundle_url,
       bundle_sha256 = EXCLUDED.bundle_sha256,
       manifest_sha256 = EXCLUDED.manifest_sha256,
       note = EXCLUDED.note,
       updated_at = now()`,
    [
      model.source.key,
      model.source.name,
      model.source.base_url,
      model.source.license_note,
      model.source.usage_scope,
      model.source.captured_at,
      model.source.bundle_url,
      model.source.bundle_sha256,
      model.source.manifest_sha256,
      model.source.note,
    ],
  );

  await upsertRows(client, {
    table: "exam_408_subjects",
    conflict: "key",
    columns: [
      ["key", "text"],
      ["source_key", "text"],
      ["short_name", "text"],
      ["title", "text"],
      ["sort_order", "int"],
    ],
  }, model.subjects);

  await upsertRows(client, {
    table: "exam_408_chapters",
    conflict: "key",
    columns: [
      ["key", "text"],
      ["source_key", "text"],
      ["subject_key", "text"],
      ["chapter_number", "int"],
      ["title", "text"],
      ["sort_order", "int"],
      ["question_count", "int"],
      ["source_url", "text"],
    ],
  }, model.chapters);

  await upsertRows(client, {
    table: "exam_408_knowledge_points",
    conflict: "key",
    columns: [
      ["key", "text"],
      ["source_key", "text"],
      ["subject_key", "text"],
      ["chapter_key", "text"],
      ["point_number", "int"],
      ["title", "text"],
      ["summary", "text"],
      ["sort_order", "int"],
      ["question_count", "int"],
      ["tags", "jsonb"],
      ["source_url", "text"],
      ["fingerprint", "text"],
      ["status", "text"],
    ],
  }, model.points, { preservePublished });

  await upsertRows(client, {
    table: "exam_408_papers",
    conflict: "year",
    columns: [
      ["year", "int"],
      ["source_key", "text"],
      ["title", "text"],
      ["total_score", "int"],
      ["question_count", "int"],
      ["source_url", "text"],
      ["captured_at", "timestamptz"],
      ["fingerprint", "text"],
      ["status", "text"],
    ],
  }, model.papers, { preservePublished });

  await upsertRows(client, {
    table: "exam_408_questions",
    conflict: "key",
    columns: [
      ["key", "text"],
      ["source_key", "text"],
      ["paper_year", "int"],
      ["question_id", "text"],
      ["question_number", "int"],
      ["type", "text"],
      ["subject_key", "text"],
      ["points", "int"],
      ["body", "text"],
      ["stem", "text"],
      ["options", "jsonb"],
      ["answer_text", "text"],
      ["answer_letter", "text"],
      ["image_refs", "jsonb"],
      ["answer_image_refs", "jsonb"],
      ["has_image", "boolean"],
      ["video_url", "text"],
      ["video_p_offset", "int"],
      ["missing_fields", "jsonb"],
      ["source_tags", "jsonb"],
      ["tags", "jsonb"],
      ["source_url", "text"],
      ["fingerprint", "text"],
      ["status", "text"],
    ],
  }, model.questions, { preservePublished });

  await upsertRows(client, {
    table: "exam_408_tags",
    conflict: "key",
    columns: [
      ["key", "text"],
      ["source_key", "text"],
      ["kind", "text"],
      ["name", "text"],
      ["normalized_name", "text"],
    ],
  }, model.tags);

  await client.query(
    `DELETE FROM exam_408_question_tags
      WHERE question_key IN (
        SELECT key FROM exam_408_questions WHERE source_key = $1
      )`,
    [SOURCE_KEY],
  );
  await client.query(
    `DELETE FROM exam_408_knowledge_point_tags
      WHERE knowledge_point_key IN (
        SELECT key FROM exam_408_knowledge_points WHERE source_key = $1
      )`,
    [SOURCE_KEY],
  );
  await client.query(
    `DELETE FROM exam_408_question_knowledge_points
      WHERE question_key IN (
        SELECT key FROM exam_408_questions WHERE source_key = $1
      )`,
    [SOURCE_KEY],
  );

  await upsertRows(client, {
    table: "exam_408_question_knowledge_points",
    conflict: "question_key, knowledge_point_key",
    columns: [
      ["question_key", "text"],
      ["knowledge_point_key", "text"],
      ["link_source", "text"],
    ],
  }, model.questionKnowledgeLinks);

  await upsertRows(client, {
    table: "exam_408_question_tags",
    conflict: "question_key, tag_key",
    columns: [
      ["question_key", "text"],
      ["tag_key", "text"],
    ],
  }, model.questionTagLinks);

  await upsertRows(client, {
    table: "exam_408_knowledge_point_tags",
    conflict: "knowledge_point_key, tag_key",
    columns: [
      ["knowledge_point_key", "text"],
      ["tag_key", "text"],
    ],
  }, model.pointTagLinks);
}

async function upsertRows(client, spec, rows, options = {}) {
  if (rows.length === 0) return;

  const conflictColumns = spec.conflict
    .split(",")
    .map((column) => column.trim());
  const insertColumns = spec.columns.map(([name]) => name);
  const definitions = spec.columns
    .map(([name, type]) => `${name} ${type}`)
    .join(", ");
  const selectColumns = insertColumns.map((name) => `x.${name}`).join(", ");
  const updates = insertColumns
    .filter((name) => !conflictColumns.includes(name))
    .map((name) => `${name} = EXCLUDED.${name}`)
    .join(", ");
  const conflict = conflictColumns.join(", ");
  const guard =
    options.preservePublished && spec.columns.some(([name]) => name === "status")
      ? ` WHERE ${spec.table}.status <> 'published'`
      : "";
  const updateSql = updates ? `DO UPDATE SET ${updates}${guard}` : "DO NOTHING";
  const sql = `
    INSERT INTO ${spec.table} (${insertColumns.join(", ")})
    SELECT ${selectColumns}
    FROM jsonb_to_recordset($1::jsonb) AS x(${definitions})
    ON CONFLICT (${conflict}) ${updateSql}
  `;

  await client.query(sql, [JSON.stringify(rows)]);
}

async function readDatabaseCounts(client, sourceKey = SOURCE_KEY) {
  const { rows } = await client.query(
    `SELECT
       (SELECT count(*)::int FROM exam_408_subjects WHERE source_key = $1) AS subjects,
       (SELECT count(*)::int FROM exam_408_chapters WHERE source_key = $1) AS chapters,
       (SELECT count(*)::int FROM exam_408_knowledge_points WHERE source_key = $1) AS points,
       (SELECT count(*)::int FROM exam_408_papers WHERE source_key = $1) AS papers,
       (SELECT count(*)::int FROM exam_408_questions WHERE source_key = $1) AS questions,
       (SELECT count(*)::int FROM exam_408_question_knowledge_points link
          JOIN exam_408_questions q ON q.key = link.question_key
         WHERE q.source_key = $1) AS links,
       (SELECT count(*)::int FROM exam_408_tags WHERE source_key = $1) AS tags,
       (SELECT count(*)::int FROM exam_408_questions
          WHERE source_key = $1
            AND type = 'choice'
            AND jsonb_array_length(options) = 4
            AND answer_letter IS NOT NULL) AS valid_choices,
       (SELECT count(*)::int FROM exam_408_questions
          WHERE source_key = $1
            AND has_image
            AND jsonb_array_length(image_refs) > 0) AS image_questions,
       (SELECT count(*)::int FROM (
          SELECT paper_year
          FROM exam_408_questions
          WHERE source_key = $1
          GROUP BY paper_year
          HAVING count(*) <> $2 OR sum(points) <> $3
        ) bad) AS invalid_papers`,
    [sourceKey, EXPECTED.questionsPerYear, EXPECTED.pointsPerYear],
  );
  return rows[0];
}

function validateDatabaseCounts(counts, model) {
  const expected = {
    subjects: model.counts.subjects,
    chapters: model.counts.chapters,
    points: model.counts.points,
    papers: model.counts.papers,
    questions: model.counts.questions,
    links: model.counts.questionKnowledgeLinks,
    tags: model.counts.tags,
    valid_choices: model.questions.filter(
      (question) => question.type === "choice",
    ).length,
    image_questions: model.questions.filter((question) => question.has_image).length,
    invalid_papers: 0,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (Number(counts[key]) !== Number(value)) {
      throw new Error(
        `Database validation failed for ${key}: expected ${value}, got ${counts[key]}.`,
      );
    }
  }
}

class TagRegistry {
  constructor() {
    this.byKindAndName = new Map();
    this.byKey = new Map();
    this.list = [];
  }

  add(kind, stableKey, name) {
    const cleanName = String(name ?? "").trim();
    if (!cleanName) return null;

    const normalizedName = normalizeTag(cleanName);
    const uniqueKey = `${kind}\0${normalizedName}`;
    const existing = this.byKindAndName.get(uniqueKey);
    if (existing) return existing;

    const safeStableKey = stableKey || sha1(normalizedName).slice(0, 16);
    const key = `${kind}:${safeStableKey}`;
    const row = {
      key,
      kind,
      name: cleanName,
      normalized_name: normalizedName,
    };
    this.byKindAndName.set(uniqueKey, row);
    this.byKey.set(key, row);
    this.list.push(row);
    return row;
  }

  getByKey(key) {
    return this.byKey.get(key);
  }

  rows() {
    return this.list;
  }
}

function prefixed(value) {
  return `${KEY_PREFIX}/${value}`;
}

function normalizeTag(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function fingerprint(value) {
  return sha256(JSON.stringify(value));
}

const IS_MAIN =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

export {
  assertSchema,
  buildImportModel,
  readDatabaseCounts,
  validateDatabaseCounts,
  validateModel,
  writeModel,
};

if (IS_MAIN) await main();
