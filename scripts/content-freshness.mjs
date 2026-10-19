#!/usr/bin/env node
/**
 * 内容切源漂移门禁（S7-4）：仓库 packages/content vs DB。
 *
 * 用法：
 *   node scripts/content-freshness.mjs                 # FRESH(0) / STALE(1) / UNKNOWN(2)
 *   node scripts/content-freshness.mjs --json          # 只输出 JSON（含 machineLine）
 *   node scripts/content-freshness.mjs --warn          # 只告警，退出码恒 0（CI 观察期）
 *   node scripts/content-freshness.mjs --allow-unknown # UNKNOWN 降为 0（无 PG 的开发机）
 *   node scripts/content-freshness.mjs --repo-only     # 只算仓库指纹/版本（调试）
 *   node scripts/content-freshness.mjs --db-only       # 只探 DB marker/行数（调试）
 *   node scripts/content-freshness.mjs --repo-version v --db-version w  # 判定演示/演练
 *
 * 环境变量：PGHOST（默认 127.0.0.1）/ PGPORT（5432）/ PGUSER（postgres）/ PGPASSWORD（空）/ PGDATABASE（Learn-Workbench）
 *
 * 机读输出（CI/告警用正则抓这一行）：
 *   CONTENT_FRESHNESS=FRESH|STALE|UNKNOWN reason=... repo_version=... db_marker=... db_rows=...
 *
 * 退出码：0=FRESH（或 --warn / --allow-unknown 放行）/ 1=STALE / 2=UNKNOWN。
 * 接入点见 docs/S7-4-内容切源漂移门禁.md。
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_CONTENT_DIR,
  DEFAULT_PACKAGE_JSON,
  FRESHNESS,
  buildReport,
  classifyFreshness,
  formatHumanReport,
  parseArgs,
  pickDbMarkers,
  resolveExitCode,
  resolveRepoInfo,
} from "./lib/content-freshness.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_TABLES = ["content_phases", "content_topics", "learning_tracks", "learning_stages", "learning_topics", "learning_questions"];
/** 有 content_version 列、可作 marker 的表 */
const VERSION_TABLES = ["learning_tracks", "learning_questions", "content_topics"];
/** 最近内容更新时间来源（白名单内的表/列名，绝不来自用户输入） */
const TIME_SOURCES = [
  ["learning_tracks", "updated_at"],
  ["learning_stages", "updated_at"],
  ["learning_topics", "updated_at"],
  ["learning_questions", "updated_at"],
  ["content_topics", "content_updated_at"],
  ["content_topics", "updated_at"],
];

const HELP = [
  "内容切源漂移门禁（仓库 vs DB）",
  "",
  "用法：node scripts/content-freshness.mjs [--json] [--warn] [--allow-unknown] [--repo-only] [--db-only]",
  "                                     [--root <dir>] [--content-dir <dir>] [--package-json <file>]",
  "                                     [--repo-version <v>] [--db-version <v>] [--help]",
  "",
  "判定：FRESH=0 / STALE=1 / UNKNOWN=2（--warn 恒 0；--allow-unknown 把 UNKNOWN 降为 0）",
].join("\n");

function dbConfig() {
  return {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "Learn-Workbench",
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
    max: 2,
  };
}

async function tableExists(pool, table) {
  try {
    const { rows } = await pool.query("SELECT to_regclass($1) IS NOT NULL AS present", ["public." + table]);
    return rows[0]?.present === true;
  } catch {
    return false;
  }
}

async function probeDatabase(pool) {
  // 连接自检：端口不通时这里就会抛，CLI 记为 db-unreachable（而不是误判成 db-empty）
  await pool.query("SELECT 1");
  const db = {
    connected: true,
    database: dbConfig().database,
    tables: {},
    counts: {},
    versionRows: {},
    importBatches: [],
    appMeta: [],
    contentMeta: [],
    lastContentUpdatedAt: null,
  };

  for (const table of [...CONTENT_TABLES, "content_import_batch", "app_meta", "content_meta"]) {
    db.tables[table] = await tableExists(pool, table);
  }

  for (const table of CONTENT_TABLES) {
    if (!db.tables[table]) continue;
    try {
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM " + table);
      db.counts[table] = Number(rows[0]?.n ?? 0);
    } catch {
      db.counts[table] = 0;
    }
  }

  for (const table of VERSION_TABLES) {
    if (!db.tables[table]) continue;
    try {
      const { rows } = await pool.query(
        "SELECT content_version::text AS version, count(*)::int AS count FROM " + table +
          " WHERE content_version IS NOT NULL AND content_version <> '' AND content_version <> 'unknown'" +
          " GROUP BY 1 ORDER BY 2 DESC, 1"
      );
      db.versionRows[table] = rows;
    } catch {
      db.versionRows[table] = [];
    }
  }

  if (db.tables.content_import_batch) {
    try {
      const { rows } = await pool.query(
        "SELECT id, source_key AS \"sourceKey\", status, commit_sha AS \"commitSha\"," +
          " started_at AS \"startedAt\", finished_at AS \"finishedAt\", report" +
          " FROM content_import_batch" +
          " ORDER BY COALESCE(finished_at, started_at) DESC NULLS LAST, id DESC LIMIT 10"
      );
      db.importBatches = rows;
    } catch {
      db.importBatches = [];
    }
  }

  if (db.tables.app_meta) {
    try {
      const { rows } = await pool.query(
        "SELECT key, value::text AS value, updated_at AS \"updatedAt\" FROM app_meta WHERE key ILIKE '%content%' ORDER BY key LIMIT 20"
      );
      db.appMeta = rows;
    } catch {
      db.appMeta = [];
    }
  }

  if (db.tables.content_meta) {
    try {
      const { rows } = await pool.query(
        "SELECT key, value, updated_at AS \"updatedAt\" FROM content_meta ORDER BY key LIMIT 20"
      );
      db.contentMeta = rows;
    } catch {
      db.contentMeta = [];
    }
  }

  // 最近内容更新时间来源（含 content_meta）：用于「仓库比 DB 新」的漂移提示（不单独改变判定）
  let latest = 0;
  const candidates = [...TIME_SOURCES, ["content_import_batch", "finished_at"], ["content_meta", "updated_at"]];
  for (const [table, column] of candidates) {
    if (!db.tables[table]) continue;
    try {
      const { rows } = await pool.query("SELECT max(" + column + ") AS at FROM " + table);
      const ts = rows[0]?.at ? new Date(rows[0].at).getTime() : NaN;
      if (Number.isFinite(ts)) latest = Math.max(latest, ts);
    } catch {
      // 列不存在/表结构不同：跳过
    }
  }
  db.lastContentUpdatedAt = latest > 0 ? new Date(latest).toISOString() : null;
  return db;
}

function emit({ repo, db, result, args, mode }) {
  if (args.json) {
    const report = buildReport({ repo, db, result });
    console.log(JSON.stringify({ ...report, mode }, null, 2));
    return;
  }
  console.log(formatHumanReport({ repo, db, result }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return 0;
  }

  const root = args.root ? path.resolve(args.root) : ROOT;
  const contentDir = args.contentDir || DEFAULT_CONTENT_DIR;
  const packageJson = args.packageJson || DEFAULT_PACKAGE_JSON;

  // ---- 仓库侧 ----
  let repo = null;
  if (!args.dbOnly) {
    try {
      repo = resolveRepoInfo({ root, contentDir, packageJson, gitExec: execFileSync });
    } catch (error) {
      repo = null;
      if (args.repoOnly) {
        const result = { status: FRESHNESS.UNKNOWN, reason: "repo-read-failed", detail: String(error?.message ?? error), hints: [] };
        emit({ repo: null, db: null, result, args, mode: "ERROR" });
        return 2;
      }
    }
    if (args.repoOnly) {
      const result = { status: "REPO_ONLY", reason: "repo-only-debug", detail: "仅计算仓库指纹/版本（不连 DB）", hints: [] };
      emit({ repo, db: null, result, args, mode: "REPO_ONLY" });
      return 0;
    }
  }

  // ---- DB 侧 ----
  let pool = null;
  let db = null;
  try {
    const { Pool } = require("pg");
    pool = new Pool(dbConfig());
    db = await probeDatabase(pool);
  } catch (error) {
    db = { connected: false, error: String(error?.message ?? error), database: dbConfig().database, tables: {}, counts: {}, versionRows: {} };
  } finally {
    try {
      await pool?.end();
    } catch {
      // 忽略关闭失败
    }
  }

  if (args.dbOnly) {
    if (db.connected === false) {
      const result = { status: FRESHNESS.UNKNOWN, reason: "db-unreachable", detail: db.error, hints: [] };
      emit({ repo: null, db, result, args, mode: "UNKNOWN" });
      return resolveExitCode(FRESHNESS.UNKNOWN, args);
    }
    const markers = pickDbMarkers({ ...db, repoNewestMtimeMs: 0 });
    const result = { status: "DB_ONLY", reason: "db-only-debug", detail: "仅探测 DB（不做漂移判定）", hints: [] };
    emit({ repo: null, db: markers, result, args, mode: "DB_ONLY" });
    return 0;
  }

  // ---- 判定 ----
  const markers = db.connected === false ? db : pickDbMarkers({ ...db, repoNewestMtimeMs: repo?.newestMtimeMs ?? 0 });
  const result = classifyFreshness({
    repo,
    db: markers,
    overrides: { repoVersion: args.repoVersion, dbVersion: args.dbVersion },
  });
  const repoOut = repo && args.repoVersion ? { ...repo, version: args.repoVersion, versionSource: "override" } : repo;
    const dbOut = markers && args.dbVersion ? { ...markers, version: args.dbVersion, versionSource: "override" } : markers;
    emit({ repo: repoOut, db: dbOut, result, args, mode: result.status });
  return resolveExitCode(result.status, args);
}

const code = await main();
process.exitCode = code;
