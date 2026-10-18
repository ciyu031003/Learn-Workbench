#!/usr/bin/env node
/**
 * 匿名表覆盖门禁（S1-7）。
 *
 * 背景：schema 里带 anon_id 的表有 20+ 张，而"登录时认领哪些表"是手写清单。
 * 只要新加一张带 anon_id 的表却忘了归类，匿名用户的数据就会在登录后静默消失（评审 L1）。
 *
 * 规则：db/schema.sql + db/migrations/*.sql 中所有带 anon_id 的表，
 *       必须出现在 apps/web/lib/anon-tables.ts 的
 *       ANON_CLAIM_TABLES（登录认领） 或 ANON_UNCLAIMED_TABLES（显式不认领 + 原因）里。
 *
 * 用法：node scripts/check-anon-tables.mjs
 * 退出码：0 = 全覆盖；1 = 有未归类的表（打印差异）
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitStatements } from "./check-schema-fresh.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SQL_FILES = [
  path.join(ROOT, "db/schema.sql"),
  ...readdirSync(path.join(ROOT, "db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(ROOT, "db/migrations", f)),
];

/** 从 SQL 里收集"带 anon_id 列"的表 */
export function collectAnonTables(sqlTexts) {
  const found = new Set();
  for (const text of sqlTexts) {
    for (const raw of splitStatements(text)) {
      // 去掉语句前导的行注释（splitStatements 会连注释一起返回，直接 ^CREATE 会漏判）
      const stmt = raw.replace(/^\s*(?:--[^\n]*\n\s*)*/, "").trim();
      const create = /^CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z0-9_]+)\s*\(([\s\S]*)\)$/i.exec(stmt);
      if (create) {
        if (/\banon_id\b/.test(create[2])) found.add(create[1]);
        continue;
      }
      const alter = /^ALTER TABLE\s+(?:IF EXISTS\s+)?([a-z0-9_]+)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+anon_id\b/i.exec(stmt);
      if (alter) found.add(alter[1]);
    }
  }
  return found;
}

/** 从 anon-tables.ts 解析两类清单 */
export function parseClassification(ts) {
  const claimBlock = /ANON_CLAIM_TABLES\s*=\s*\[([\s\S]*?)\]/.exec(ts)?.[1] ?? "";
  const unclaimedBlock = /ANON_UNCLAIMED_TABLES[^=]*=\s*\{([\s\S]*?)\};/.exec(ts)?.[1] ?? "";
  const claimed = new Set([...claimBlock.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
  const unclaimed = new Set([...unclaimedBlock.matchAll(/^\s*([a-z0-9_]+)\s*:/gm)].map((m) => m[1]));
  return { claimed, unclaimed };
}

function main() {
  const sqlTexts = SQL_FILES.map((f) => readFileSync(f, "utf8"));
  const found = collectAnonTables(sqlTexts);
  const ts = readFileSync(path.join(ROOT, "apps/web/lib/anon-tables.ts"), "utf8");
  const { claimed, unclaimed } = parseClassification(ts);

  const missing = [...found].filter((t) => !claimed.has(t) && !unclaimed.has(t)).sort();
  const stale = [...claimed, ...unclaimed].filter((t) => !found.has(t)).sort();

  console.log(
    "[check-anon-tables] 带 anon_id 的表 " + found.size + " 张；认领 " + claimed.size + "；显式不认领 " + unclaimed.size
  );
  if (stale.length) {
    console.warn("[check-anon-tables] 警告：清单里有、SQL 里已不存在的表（可清理）：" + stale.join(", "));
  }
  if (missing.length) {
    console.error(
      "[check-anon-tables] 失败：以下表带 anon_id 但未归类（登录后匿名数据会静默丢失）：\n" +
        missing.map((t) => "  - " + t).join("\n") +
        "\n请在 apps/web/lib/anon-tables.ts 的 ANON_CLAIM_TABLES 或 ANON_UNCLAIMED_TABLES 中登记。"
    );
    process.exitCode = 1;
    return;
  }
  console.log("[check-anon-tables] 覆盖检查通过 ✅");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
