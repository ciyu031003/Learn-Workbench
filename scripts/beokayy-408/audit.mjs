#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import {
  ORIGIN,
  parseArgs,
  readJson,
  resolveOutDir,
  sha256,
  writeJson,
} from "./common.mjs";
import {
  assertSchema,
  buildImportModel,
  readDatabaseCounts,
  validateDatabaseCounts,
  validateModel,
} from "./import-db.mjs";

const require = createRequire(import.meta.url);
const SOURCE_KEY = "beokayy-408";
const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolveOutDir(args);
const PARSED_DIR = path.join(OUT_DIR, "parsed");
const REPORT_FILE = path.join(OUT_DIR, "audit", "report.json");
const REQUIRE_DB = Boolean(args["require-db"]);
const SKIP_DB = Boolean(args["skip-db"]);

async function main() {
  const manifestFile = path.join(OUT_DIR, "raw", "manifest.json");
  const [manifest, papersFile, questionsFile, knowledgeFile, manifestBytes] =
    await Promise.all([
      readJson(manifestFile),
      readJson(path.join(PARSED_DIR, "papers.json")),
      readJson(path.join(PARSED_DIR, "questions.json")),
      readJson(path.join(PARSED_DIR, "knowledge-index.json")),
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

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      key: SOURCE_KEY,
      origin: ORIGIN,
      capturedAt: manifest.capturedAt,
      bundleUrl: model.source.bundle_url,
      bundleSha256: model.source.bundle_sha256,
      manifestSha256: model.source.manifest_sha256,
      usageScope: model.source.usage_scope,
    },
    snapshot: summarizeSnapshot(model),
    database: {
      status: SKIP_DB ? "skipped" : "not-connected",
      counts: null,
      source: null,
    },
    issues: [],
  };

  if (!SKIP_DB) {
    await inspectDatabase(report, model);
  }

  if (REQUIRE_DB && report.database.status !== "connected") {
    report.issues.push({
      code: "database_required",
      message: "Database verification was required but no database was inspected.",
    });
  }

  await writeJson(REPORT_FILE, report);

  console.log(
    [
      `[beokayy-408] audit ${report.issues.length === 0 ? "passed" : "failed"}`,
      `snapshot=${report.snapshot.papers}p/${report.snapshot.questions}q`,
      `knowledge=${report.snapshot.chapters}c/${report.snapshot.points}pts`,
      `database=${report.database.status}`,
      `issues=${report.issues.length}`,
    ].join(" "),
  );

  if (report.issues.length > 0) process.exitCode = 1;
}

function summarizeSnapshot(model) {
  const questionsBySubject = new Map();
  for (const question of model.questions) {
    questionsBySubject.set(
      question.subject_key,
      (questionsBySubject.get(question.subject_key) ?? 0) + 1,
    );
  }
  const pointSubject = new Map(
    model.points.map((point) => [point.key, point.subject_key]),
  );
  const linksBySubject = new Map();
  for (const link of model.questionKnowledgeLinks) {
    const subjectKey = pointSubject.get(link.knowledge_point_key);
    if (!subjectKey) continue;
    linksBySubject.set(subjectKey, (linksBySubject.get(subjectKey) ?? 0) + 1);
  }

  const subjects = model.subjects.map((subject) => {
    const chapters = model.chapters.filter(
      (chapter) => chapter.subject_key === subject.key,
    );
    const points = model.points.filter(
      (point) => point.subject_key === subject.key,
    );
    return {
      key: subject.key,
      title: subject.title,
      chapters: chapters.length,
      points: points.length,
      questions: questionsBySubject.get(subject.key) ?? 0,
      questionLinks: linksBySubject.get(subject.key) ?? 0,
    };
  });

  return {
    years: model.papers.map((paper) => paper.year),
    papers: model.counts.papers,
    questions: model.counts.questions,
    choices: model.questions.filter((question) => question.type === "choice")
      .length,
    comprehensive: model.questions.filter(
      (question) => question.type === "comprehensive",
    ).length,
    imageQuestions: model.questions.filter((question) => question.has_image)
      .length,
    subjects: model.counts.subjects,
    chapters: model.counts.chapters,
    points: model.counts.points,
    questionLinks: model.counts.questionKnowledgeLinks,
    tags: model.counts.tags,
    bySubject: subjects,
  };
}

async function inspectDatabase(report, model) {
  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch (error) {
    report.issues.push({
      code: "pg_module_missing",
      message: String(error?.message ?? error),
    });
    return;
  }

  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: String(args.database ?? process.env.PGDATABASE ?? "Learn-Workbench"),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  let client;
  try {
    client = await pool.connect();
    await assertSchema(client);
    const counts = await readDatabaseCounts(client, SOURCE_KEY);
    validateDatabaseCounts(counts, model);

    const source = await client.query(
      `SELECT bundle_sha256, manifest_sha256, usage_scope, captured_at
         FROM exam_408_source_snapshots
        WHERE key = $1`,
      [SOURCE_KEY],
    );
    const row = source.rows[0] ?? null;
    const batchResult = await client.query(
      `SELECT id, mode, status, commit_sha, report, started_at, finished_at
         FROM content_import_batch
        WHERE source_key = $1
        ORDER BY id DESC
        LIMIT 1`,
      [SOURCE_KEY],
    );
    const batch = batchResult.rows[0] ?? null;

    report.database = {
      status: "connected",
      counts,
      source: row
        ? {
            bundleSha256: row.bundle_sha256,
            manifestSha256: row.manifest_sha256,
            usageScope: row.usage_scope,
            capturedAt: row.captured_at,
          }
        : null,
      batch: batch
        ? {
            id: Number(batch.id),
            mode: batch.mode,
            status: batch.status,
            commitSha: batch.commit_sha,
            report: batch.report,
            startedAt: batch.started_at,
            finishedAt: batch.finished_at,
          }
        : null,
    };

    if (!row) {
      report.issues.push({
        code: "missing_source_snapshot",
        message: `No exam_408_source_snapshots row exists for ${SOURCE_KEY}.`,
      });
      return;
    }
    if (row.bundle_sha256 !== model.source.bundle_sha256) {
      report.issues.push({
        code: "bundle_hash_mismatch",
        message: `Database bundle hash ${row.bundle_sha256} does not match snapshot ${model.source.bundle_sha256}.`,
      });
    }
    if (row.manifest_sha256 !== model.source.manifest_sha256) {
      report.issues.push({
        code: "manifest_hash_mismatch",
        message: `Database manifest hash ${row.manifest_sha256} does not match snapshot ${model.source.manifest_sha256}.`,
      });
    }
    if (!batch) {
      report.issues.push({
        code: "missing_import_batch",
        message: `No content_import_batch row exists for ${SOURCE_KEY}; run import-db.mjs first.`,
      });
    } else {
      if (batch.status === "failed") {
        report.issues.push({
          code: "failed_import_batch",
          message: `Latest import batch ${batch.id} is failed.`,
        });
      }
      const batchBundleHash = batch.report?.bundleSha256;
      if (batchBundleHash && batchBundleHash !== model.source.bundle_sha256) {
        report.issues.push({
          code: "batch_bundle_hash_mismatch",
          message: `Latest import batch bundle hash ${batchBundleHash} does not match snapshot ${model.source.bundle_sha256}.`,
        });
      }
    }
  } catch (error) {
    report.issues.push({
      code: "database_validation_failed",
      message: String(error?.message ?? error),
    });
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

await main();
