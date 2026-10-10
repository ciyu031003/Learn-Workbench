#!/usr/bin/env node
/**
 * 迁移演练（组三 · H1）：把 `db/migrations/down/NNN_*.down.sql` 当作**可执行的回滚契约**，
 * 在一次性演练库上跑「正向 → 回滚 → 再正向」，逐条断言对象真的消失又真的回来。
 *
 * 为什么不是"看一眼 down 文件"：
 *  - 回滚脚本最容易腐烂（改了列名、漏了索引），只有真跑才知道；
 *  - 演练库是一次性造的（schema.sql + 全部迁移），不碰开发库与生产库。
 *
 * 用法：
 *   node scripts/migration-drill.mjs            # 演练全部 down 文件
 *   node scripts/migration-drill.mjs --keep     # 保留演练库以便排查
 * 环境变量：PGHOST/PGPORT/PGUSER/PGPASSWORD；--db=lwb_migration_drill 可改库名。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { splitStatements } from "./check-schema-fresh.mjs";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UP_DIR = path.join(ROOT, "db", "migrations");
const DOWN_DIR = path.join(UP_DIR, "down");

const keep = process.argv.includes("--keep");
const dbArg = process.argv.find((a) => a.startsWith("--db="));
const DRILL_DB = dbArg ? dbArg.slice(5) : "lwb_migration_drill";

const CONN = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
};

/** 把 down 文件解析成「该消失的对象」清单。 */
export function parseDownContract(sql) {
  const indexes = [...sql.matchAll(/DROP\s+INDEX\s+IF\s+EXISTS\s+([a-z0-9_]+)/gi)].map((m) => m[1]);
  const constraints = [...sql.matchAll(/ALTER\s+TABLE\s+([a-z0-9_]+)\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+([a-z0-9_]+)/gi)].map(
    (m) => ({ table: m[1], name: m[2] })
  );
  const columns = [];
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+([a-z0-9_]+)\s+DROP\s+COLUMN\s+IF\s+EXISTS\s+([^;]+);/gi)) {
    const table = m[1];
    const first = /^\s*([a-z0-9_]+)/.exec(m[2])?.[1];
    if (first) columns.push({ table, name: first });
    for (const col of [...m[2].matchAll(/DROP\s+COLUMN\s+IF\s+EXISTS\s+([a-z0-9_]+)/gi)].map((x) => x[1])) {
      columns.push({ table, name: col });
    }
  }
  return { indexes, constraints, columns };
}

async function indexExists(db, name) {
  const r = await db.query("SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = $1", [name]);
  return r.rowCount > 0;
}
async function columnExists(db, table, name) {
  const r = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
    [table, name]
  );
  return r.rowCount > 0;
}
async function constraintExists(db, table, name) {
  const r = await db.query(
    "SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relname=$1 AND c.conname=$2",
    [table, name]
  );
  return r.rowCount > 0;
}

async function applyFile(db, file) {
  for (const stmt of splitStatements(readFileSync(file, "utf8"))) {
    await db.query(stmt);
  }
}

async function main() {
  if (!existsSync(DOWN_DIR)) {
    console.log("[migration-drill] 没有 db/migrations/down/，无回滚契约可演练（跳过）");
    return;
  }
  const downFiles = readdirSync(DOWN_DIR).filter((f) => f.endsWith(".down.sql")).sort();
  if (downFiles.length === 0) {
    console.log("[migration-drill] db/migrations/down/ 为空，跳过");
    return;
  }

  const admin = new Pool({ ...CONN, database: "postgres" });
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${DRILL_DB}`);
    await admin.query(`CREATE DATABASE ${DRILL_DB}`);
  } finally {
    await admin.end();
  }

  const db = new Pool({ ...CONN, database: DRILL_DB });
  const failures = [];
  try {
    await applyFile(db, path.join(ROOT, "db", "schema.sql"));
    for (const f of readdirSync(UP_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      await applyFile(db, path.join(UP_DIR, f));
    }
    console.log(`[migration-drill] 正向基线已应用（schema.sql + 全部迁移）`);

    for (const downFile of downFiles) {
      const prefix = downFile.split("_")[0];
      const upFile = readdirSync(UP_DIR).find((f) => f.startsWith(`${prefix}_`) && f.endsWith(".sql"));
      if (!upFile) {
        failures.push(`${downFile}: 找不到配对的 ${prefix}_*.sql`);
        continue;
      }
      const contract = parseDownContract(readFileSync(path.join(DOWN_DIR, downFile), "utf8"));
      const total = contract.indexes.length + contract.constraints.length + contract.columns.length;
      if (total === 0) {
        failures.push(`${downFile}: 未解析出任何 DROP 对象，回滚契约形同空文`);
        continue;
      }

      await applyFile(db, path.join(DOWN_DIR, downFile));
      const leftover = [];
      for (const n of contract.indexes) if (await indexExists(db, n)) leftover.push(`索引 ${n}`);
      for (const c of contract.constraints) if (await constraintExists(db, c.table, c.name)) leftover.push(`约束 ${c.name}`);
      for (const c of contract.columns) if (await columnExists(db, c.table, c.name)) leftover.push(`列 ${c.table}.${c.name}`);
      if (leftover.length) failures.push(`${downFile}: 回滚后仍残留 ${leftover.join(", ")}`);

      await applyFile(db, path.join(UP_DIR, upFile));
      const missing = [];
      for (const n of contract.indexes) if (!(await indexExists(db, n))) missing.push(`索引 ${n}`);
      for (const c of contract.constraints) if (!(await constraintExists(db, c.table, c.name))) missing.push(`约束 ${c.name}`);
      for (const c of contract.columns) if (!(await columnExists(db, c.table, c.name))) missing.push(`列 ${c.table}.${c.name}`);
      if (missing.length) failures.push(`${upFile}: 重新正向应用后仍缺 ${missing.join(", ")}`);

      if (leftover.length === 0 && missing.length === 0) {
        console.log(`[migration-drill] ✔ ${downFile}：回滚 ${total} 个对象 → 再正向 → 全部复原`);
      }
    }
  } finally {
    await db.end();
    if (!keep) {
      const cleanup = new Pool({ ...CONN, database: "postgres" });
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS ${DRILL_DB}`);
      } finally {
        await cleanup.end();
      }
    }
  }

  if (failures.length) {
    console.error(`[migration-drill] ${failures.length} 处失败：`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[migration-drill] 全部回滚契约通过 ✔（${downFiles.length} 个 down 文件）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error("[migration-drill] 失败：" + (e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  });
}
