#!/usr/bin/env node
/**
 * 408 专区知识点正文：本地 JSON → exam_408_knowledge_points.body（2026-11）。
 *
 * 背景：专区 99 个知识点只有一句摘要，点开后直接是真题列表。正文放在独立列 body（jsonb string[]），
 * 与快照导入解耦 —— scripts/beokayy-408/import-db.mjs 的 upsert 不含 body，重导快照不会冲掉正文。
 *
 * 用法：
 *   node scripts/beokayy-408/enrich-point-bodies.mjs --check     # 只校验本地 JSON（写作用，不需要库）
 *   node scripts/beokayy-408/enrich-point-bodies.mjs --check --only=ds   # 只校验某几科（并行写作时用）
 *   node scripts/beokayy-408/enrich-point-bodies.mjs --dry-run   # 校验 + 连库核对 key（不写）
 *   node scripts/beokayy-408/enrich-point-bodies.mjs --apply     # 校验 + 写库（事务）
 *
 * 校验口径（与 .local/408-point-body-spec.md 一致）：
 *   - 每点 4–12 段；正文合计 600–1800 汉字；单段 30–320 字符
 *   - 禁止 HTML 标签 / Markdown 代码围栏 / javascript: / emoji
 *   - 同一科目内不同知识点不得出现 ≥40 字连续重复（40-gram 集合比对）
 *   - 若本地有 .local/408-points.json（生产快照清单），核对知识点 key 不多不少
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BODY_DIR = path.join(ROOT, "scripts/beokayy-408/point-bodies");
const MANIFEST = path.join(ROOT, ".local/408-points.json");
const FILES = { ds: "ds.json", co: "co.json", os: "os.json", net: "net.json" };

const LIMITS = {
  minParagraphs: 4,
  maxParagraphs: 12,
  minTotalCjk: 600,
  maxTotalCjk: 1800,
  minParagraphChars: 30,
  maxParagraphChars: 320,
  duplicateGram: 40,
};

const FORBIDDEN = [
  [/<\s*[a-zA-Z/][^>]*>/u, "HTML 标签"],
  [/```/u, "Markdown 代码围栏"],
  [/\bjavascript:/iu, "javascript: 伪协议"],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u, "emoji"],
];

const args = new Set(process.argv.slice(2));
const ONLY_ARG = process.argv.find((item) => item.startsWith("--only="));
/** 只校验/只写某几科（ds,co,os,net）：并行写作时避免被其他科目未完成拖红。 */
const ONLY_CODES = ONLY_ARG
  ? ONLY_ARG.slice("--only=".length).split(",").map((item) => item.trim()).filter((item) => item in FILES)
  : null;
const SUBJECT_CODE = { DS: "ds", CO: "co", OS: "os", CN: "net" };
const MODE = args.has("--apply") ? "apply" : args.has("--dry-run") ? "dry-run" : args.has("--check") ? "check" : "";
if (!MODE) {
  console.error("用法：node scripts/beokayy-408/enrich-point-bodies.mjs --check|--dry-run|--apply");
  process.exit(2);
}

const cjkCount = (text) => (text.match(/[\u4e00-\u9fff]/gu) ?? []).length;
const normalize = (text) => text.replace(/\s+/gu, "");

async function readJson(file) {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw);
}

async function loadBodies() {
  const entries = new Map();
  const errors = [];
  const warnings = [];
  for (const [code, file] of Object.entries(FILES)) {
    if (ONLY_CODES && !ONLY_CODES.includes(code)) continue;
    const abs = path.join(BODY_DIR, file);
    let data;
    try {
      data = await readJson(abs);
    } catch (error) {
      errors.push(`${file}: 读取或 JSON 解析失败：${error.message}`);
      continue;
    }
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      errors.push(`${file}: 顶层必须是 { key: string[] } 对象`);
      continue;
    }
    for (const [key, paragraphs] of Object.entries(data)) {
      if (entries.has(key)) {
        errors.push(`${key}: 在多个文件里重复出现`);
        continue;
      }
      if (!/^beokayy-408\/(ds|co|os|cn)-\d{2}-\d{2}$/u.test(key)) {
        errors.push(`${key}: key 形状不对（应为 beokayy-408/ds-01-01 这类）`);
        continue;
      }
      if (!Array.isArray(paragraphs)) {
        errors.push(`${key}: 值必须是字符串数组`);
        continue;
      }
      entries.set(key, { code, paragraphs });
    }
  }
  return { entries, errors, warnings };
}

function validateEntry(key, paragraphs) {
  const problems = [];
  if (paragraphs.length < LIMITS.minParagraphs || paragraphs.length > LIMITS.maxParagraphs) {
    problems.push(`段落数 ${paragraphs.length} 不在 ${LIMITS.minParagraphs}-${LIMITS.maxParagraphs}`);
  }
  let totalCjk = 0;
  paragraphs.forEach((raw, index) => {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) {
      problems.push(`第 ${index + 1} 段为空`);
      return;
    }
    const chars = [...text].length;
    if (chars < LIMITS.minParagraphChars || chars > LIMITS.maxParagraphChars) {
      problems.push(`第 ${index + 1} 段 ${chars} 字符（要求 ${LIMITS.minParagraphChars}-${LIMITS.maxParagraphChars}）`);
    }
    totalCjk += cjkCount(text);
    for (const [pattern, label] of FORBIDDEN) {
      if (pattern.test(text)) problems.push(`第 ${index + 1} 段含${label}`);
    }
  });
  if (totalCjk < LIMITS.minTotalCjk || totalCjk > LIMITS.maxTotalCjk) {
    problems.push(`正文 ${totalCjk} 汉字（要求 ${LIMITS.minTotalCjk}-${LIMITS.maxTotalCjk}）`);
  }
  return problems;
}

function checkDuplicates(entries) {
  const problems = [];
  const gramOwners = new Map();
  for (const [key, { code, paragraphs }] of entries) {
    const perPoint = new Set();
    for (const paragraph of paragraphs) {
      const text = normalize(String(paragraph));
      for (let i = 0; i + LIMITS.duplicateGram <= text.length; i += 1) {
        const gram = text.slice(i, i + LIMITS.duplicateGram);
        if (/^[\u4e00-\u9fff]{40}$/u.test(gram) === false) continue;
        perPoint.add(gram);
      }
    }
    for (const gram of perPoint) {
      const owner = gramOwners.get(gram);
      if (!owner) gramOwners.set(gram, { key, code });
      else if (owner.key !== key && owner.code === code) {
        problems.push(`${key} 与 ${owner.key} 有 ≥${LIMITS.duplicateGram} 字连续重复：${gram.slice(0, 20)}…`);
        break;
      }
    }
  }
  return problems;
}

async function validateCoverage(entries, errors, warnings) {
  let manifest = null;
  try {
    manifest = await readJson(MANIFEST);
  } catch {
    warnings.push("没有 .local/408-points.json：跳过「知识点不多不少」覆盖核对（服务器/CI 环境属正常）");
    return;
  }
  if (!Array.isArray(manifest)) {
    warnings.push(".local/408-points.json 格式不是数组：跳过覆盖核对");
    return;
  }
  const presentCodes = new Set([...entries.values()].map((item) => item.code));
  const codesToCheck = ONLY_CODES ?? [...presentCodes];
  const expected = new Set(
    manifest
      .filter((item) => codesToCheck.includes(SUBJECT_CODE[item.subjectShort] ?? ""))
      .map((item) => item.key),
  );
  for (const [code, file] of Object.entries(FILES)) {
    if (codesToCheck.includes(code) && !presentCodes.has(code)) {
      warnings.push(`${file} 尚无正文：跳过该科目的覆盖核对`);
    }
  }
  for (const key of expected) {
    if (!entries.has(key)) errors.push(`缺少知识点正文：${key}`);
  }
  for (const key of entries.keys()) {
    if (!expected.has(key)) errors.push(`多出未知知识点（不在该科目清单或尚未在清单中）：${key}`);
  }
}

async function loadPg() {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  try {
    return require("pg").Pool;
  } catch (error) {
    throw new Error("无法加载 pg 模块（apply/dry-run 需要）：" + error.message);
  }
}

async function applyToDb(entries, { dryRun }) {
  const Pool = await loadPg();
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
    database: process.env.PGDATABASE || "Learn-Workbench",
  });
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT key, subject_key FROM exam_408_knowledge_points ORDER BY key");
    const known = new Set(rows.map((row) => row.key));
    const unknown = [...entries.keys()].filter((key) => !known.has(key));
    if (unknown.length > 0) throw new Error(`库中不存在这些知识点：${unknown.join(", ")}`);
    const missing = rows.filter((row) => !entries.has(row.key)).map((row) => row.key);
    if (missing.length > 0) {
      console.warn(`[enrich] 库里有 ${missing.length} 个知识点本次没有正文（保持原样）：${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}`);
    }
    if (dryRun) {
      console.log(`[enrich] dry-run：将写入 ${entries.size} 个知识点正文（库中合计 ${known.size}）`);
      return;
    }
    await client.query("BEGIN");
    let updated = 0;
    for (const [key, { paragraphs }] of entries) {
      const body = JSON.stringify(paragraphs.map((text) => String(text).trim()));
      const result = await client.query(
        "UPDATE exam_408_knowledge_points SET body = $2::jsonb, updated_at = now() WHERE key = $1",
        [key, body],
      );
      updated += result.rowCount ?? 0;
    }
    await client.query("COMMIT");
    console.log(`[enrich] 已写入 ${updated} 个知识点正文（共 ${entries.size} 条）`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const { entries, errors, warnings } = await loadBodies();
  for (const [key, { paragraphs }] of entries) {
    for (const problem of validateEntry(key, paragraphs)) errors.push(`${key}: ${problem}`);
  }
  errors.push(...checkDuplicates(entries));
  await validateCoverage(entries, errors, warnings);

  for (const warning of warnings) console.warn("[enrich] ⚠️ " + warning);
  if (errors.length > 0) {
    console.error(`[enrich] ❌ 校验未通过（${errors.length} 项）：`);
    for (const message of errors.slice(0, 80)) console.error("  - " + message);
    if (errors.length > 80) console.error(`  … 还有 ${errors.length - 80} 项`);
    process.exit(1);
  }
  console.log(`[enrich] ✅ 本地校验通过：${entries.size} 个知识点，共 ${[...entries.values()].reduce((sum, item) => sum + item.paragraphs.length, 0)} 段`);
  if (MODE === "check") return;
  await applyToDb(entries, { dryRun: MODE === "dry-run" });
}

main().catch((error) => {
  console.error("[enrich] 失败：" + error.message);
  process.exit(1);
});
