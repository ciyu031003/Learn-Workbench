#!/usr/bin/env node
/**
 * 全新库初始化自检（踩坑 82）：在**空数据库**上依次执行
 *   db/schema.sql → db/migrations/*.sql（按文件名排序）
 * 并逐语句报告失败。
 *
 * 为什么需要：生产 init 只对**新迁移**逐个应用；`db/schema.sql` 是人工维护的完整 schema，
 * 随着迁移追加会漂移（漏列 / 依赖顺序错），这类问题在生产不会暴露，
 * 只会在「新环境 / 灾备重建」时集中爆发（2026-09-18 实测到两处）。
 *
 * 用法：node scripts/check-schema-fresh.mjs [--keep] [--db=lwb_schema_check]
 * 环境变量：PGHOST/PGPORT/PGUSER/PGPASSWORD（连到 postgres 库来 CREATE DATABASE）
 * 退出码：0 = schema.sql 与全部迁移均无失败语句；1 = 有失败（明细打印出来）
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const keep = process.argv.includes("--keep");
const dbArg = process.argv.find((a) => a.startsWith("--db="));
const CHECK_DB = dbArg ? dbArg.slice(5) : "lwb_schema_check";

const CONN = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
};

/** 按分号切 SQL，跳过 $$ ... $$ 函数体与单引号字符串 */
export function splitStatements(sql) {
  const out = [];
  let cur = "";
  let inDollar = false;
  let inQuote = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);
    if (!inQuote && two === "$$") {
      inDollar = !inDollar;
      cur += two;
      i++;
      continue;
    }
    if (!inDollar && ch === "'") inQuote = !inQuote;
    if (!inDollar && !inQuote && ch === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function main() {
  const admin = new Pool({ ...CONN, database: "postgres" });
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DB}`);
    await admin.query(`CREATE DATABASE ${CHECK_DB}`);
  } finally {
    await admin.end();
  }

  const db = new Pool({ ...CONN, database: CHECK_DB });
  const failures = [];
  try {
    const stmts = splitStatements(readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8"));
    console.log(`[schema.sql] ${stmts.length} 条语句`);
    for (const s of stmts) {
      try {
        await db.query(s);
      } catch (e) {
        failures.push({ where: "schema.sql", first: s.split("\n")[0].slice(0, 90), msg: e.message });
      }
    }

    const dir = path.join(ROOT, "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    console.log(`[migrations] ${files.length} 个文件`);
    for (const f of files) {
      try {
        await db.query(readFileSync(path.join(dir, f), "utf8"));
      } catch (e) {
        failures.push({ where: f, first: f, msg: e.message });
      }
    }
  } finally {
    await db.end();
    if (!keep) {
      const cleanup = new Pool({ ...CONN, database: "postgres" });
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS ${CHECK_DB}`);
      } finally {
        await cleanup.end();
      }
    }
  }

  if (failures.length === 0) {
    console.log("全新库初始化自检通过 ✅（schema.sql + 全部迁移）");
    return;
  }
  console.error(`全新库初始化有 ${failures.length} 处失败：`);
  for (const f of failures) console.error(`  - [${f.where}] ${f.first} => ${f.msg}`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error("[check-schema-fresh] 失败：" + (e instanceof Error ? e.message : String(e)));
  process.exitCode = 1;
});
