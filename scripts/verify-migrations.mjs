#!/usr/bin/env node
/**
 * 迁移一致性校验（P1）：
 *  1) 编号检查：db/migrations/*.sql 前缀编号是否递增、有无重复/跳号
 *  2) Schema 漂移检查：迁移中新建的表是否在 db/schema.sql 中登记（完整 schema 应包含全部表）
 * 用法：node scripts/verify-migrations.mjs [--strict]
 * 退出码：有错误（编号重复/非法）→ 1；仅警告（跳号/schema 漂移）→ 0（--strict 时也退出 1）
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIG_DIR = path.join(ROOT, "db", "migrations");
const SCHEMA_FILE = path.join(ROOT, "db", "schema.sql");

const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];

// ---------- 1. 编号检查 ----------
const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
const nums = [];
for (const f of files) {
  const m = f.match(/^(\d+)_/);
  if (!m) {
    errors.push(`文件名缺少编号前缀: ${f}`);
    continue;
  }
  nums.push(Number(m[1]));
}
const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
if (dup.length) errors.push(`重复的迁移编号: ${[...new Set(dup)].join(", ")}`);
for (let i = 1; i < nums.length; i++) {
  const gap = nums[i] - nums[i - 1];
  if (gap !== 1) warnings.push(`迁移编号跳号: ${nums[i - 1]} → ${nums[i]}（缺 ${nums[i - 1] + 1}）`);
}
console.log(`[migrations] ${files.length} 个迁移文件：${nums.join(", ")}`);

// ---------- 2. Schema 漂移检查 ----------
const schemaSql = existsSync(SCHEMA_FILE) ? readFileSync(SCHEMA_FILE, "utf8") : "";
const schemaTables = new Set(
  [...schemaSql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_]+)/gi)].map((m) => m[1])
);
const migrationTables = new Set();
for (const f of files) {
  const sql = readFileSync(path.join(MIG_DIR, f), "utf8");
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_]+)/gi)) {
    migrationTables.add(m[1]);
  }
}
const missing = [...migrationTables].filter((t) => !schemaTables.has(t)).sort();
if (missing.length) {
  const list = missing.join(", ");
  warnings.push(`迁移中新建但 schema.sql 未登记的表（${missing.length}）: ${list}`);
} else {
  console.log("[schema] 迁移新建表均已登记在 schema.sql ✅");
}

// ---------- 输出 ----------
for (const w of warnings) console.log(`[warn] ${w}`);
for (const e of errors) console.error(`[error] ${e}`);
if (strict && warnings.length) {
  console.error(`[strict] ${warnings.length} 条警告按 --strict 视为失败`);
  process.exitCode = 1;
}
if (errors.length) process.exitCode = 1;
if (!warnings.length && !errors.length) console.log("全部检查通过 ✅");