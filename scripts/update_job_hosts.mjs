#!/usr/bin/env node
/**
 * 招花 · hosts 信息源注册表更新器
 * 读取 config/job-hosts/sources.json → 校验 → 落库 job_crawler_sources → 写 app_meta(job_hosts)
 * 用法：node scripts/update_job_hosts.mjs [--file 路径] [--dry-run]
 * 环境变量：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILE = path.join(REPO_ROOT, "config", "job-hosts", "sources.json");

const VALID_CATEGORIES = ["internet", "gongkao", "gongbian", "yangqi"];
const VALID_CHANNELS = ["job", "announcement", "event"];
const VALID_ENGINES = ["http", "browser"];

function validate(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") return ["sources.json 不是有效对象"];
  const meta = doc.meta || {};
  const sources = Array.isArray(doc.sources) ? doc.sources : [];
  if (sources.length === 0) errors.push("sources 为空");
  const ids = new Set();
  for (const [i, s] of sources.entries()) {
    if (!s.id || typeof s.id !== "string") errors.push(`sources[${i}].id 缺失`);
    else if (ids.has(s.id)) errors.push(`sources[${i}].id 重复: ${s.id}`);
    else ids.add(s.id);
    if (!VALID_CATEGORIES.includes(s.category)) errors.push(`sources[${i}].category 非法: ${s.category}`);
    if (!VALID_CHANNELS.includes(s.channel)) errors.push(`sources[${i}].channel 非法: ${s.channel}`);
    if (!VALID_ENGINES.includes(s.engine)) errors.push(`sources[${i}].engine 非法: ${s.engine}`);
    if (!s.name) errors.push(`sources[${i}].name 缺失`);
    if (!s.list || !s.list.url) errors.push(`sources[${i}].list.url 缺失`);
  }
  return errors;
}

async function upsertSources(pool, sources, version, generatedAt) {
  for (const s of sources) {
    await pool.query(
      `INSERT INTO job_crawler_sources
         (id, category, channel, name, engine, base_url, list_config, detail_config,
          deadline_parse, rate_limit_ms, max_items_per_run, max_pages, risk, enabled, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         category=EXCLUDED.category, channel=EXCLUDED.channel, name=EXCLUDED.name,
         engine=EXCLUDED.engine, base_url=EXCLUDED.base_url,
         list_config=EXCLUDED.list_config, detail_config=EXCLUDED.detail_config,
         deadline_parse=EXCLUDED.deadline_parse, rate_limit_ms=EXCLUDED.rate_limit_ms,
         max_items_per_run=EXCLUDED.max_items_per_run, max_pages=EXCLUDED.max_pages,
         risk=EXCLUDED.risk, enabled=EXCLUDED.enabled, note=EXCLUDED.note, updated_at=now()`,
      [
        s.id, s.category, s.channel, s.name, s.engine, s.base_url || "",
        JSON.stringify({ ...(s.list || {}), title_filter: s.title_filter || undefined }),
        JSON.stringify(s.detail || {}),
        !!s.deadline_parse,
        Number(s.rate_limit_ms || 3000),
        Number(s.max_items_per_run || 20),
        Number(s.max_pages || 1),
        s.risk || "L1",
        s.enabled !== false,
        s.note || "",
      ]
    );
  }
  // 标记不在注册表中的旧源为禁用（不删除，保留历史/健康数据）
  const ids = sources.map((s) => s.id);
  await pool.query(
    `UPDATE job_crawler_sources SET enabled = false, updated_at = now()
      WHERE enabled = true AND NOT (id = ANY($1::text[]))`,
    [ids]
  );
  await pool.query(
    `INSERT INTO app_meta(key, value)
     VALUES ('job_hosts', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify({ version: Number(version || 1), updated_at: generatedAt || new Date().toISOString() })]
  );
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name, d) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? d) : d; };
  const file = flag("--file", DEFAULT_FILE);
  const dry = args.includes("--dry-run");
  if (!existsSync(file)) {
    console.error("[fatal] hosts 文件不存在: " + file);
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const errors = validate(doc);
  if (errors.length) {
    console.error("[fatal] hosts 校验失败：\n - " + errors.join("\n - "));
    process.exit(1);
  }
  console.log("[info] hosts 校验通过：%d 个源，version=%s", doc.sources.length, doc.meta?.version);
  if (dry) {
    console.log("[dry-run] 不落库");
    process.exit(0);
  }
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "Learn-Workbench",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    max: 3,
  });
  try {
    await upsertSources(pool, doc.sources, doc.meta?.version, doc.meta?.generated_at);
    console.log("[ok] hosts 已落库：version=%s", doc.meta?.version);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("[fatal]", e && e.message ? e.message : e);
  process.exit(1);
});
