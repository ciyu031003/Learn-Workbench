#!/usr/bin/env node
/**
 * 408card.top 速记卡 → scripts/408card/cards/*.json + exam_408_cards（P0/P4）
 *
 * 站点静态资源：/js/data-{ds,co,os,cn}.js（export const points = [...]）。
 * 授权：作者已同意个人学习、非商业用途；保留署名。
 *
 * 用法：node scripts/408card/import-cards.mjs --dry-run|--apply
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAW = path.join(ROOT, ".local/408card-raw");
const OUT_DIR = path.join(ROOT, "scripts/408card/cards");
const require = createRequire(import.meta.url);

const CODES = [
  ["ds", "data-structure"],
  ["co", "computer-organization"],
  ["os", "operating-system"],
  ["cn", "computer-network"],
];
const args = new Set(process.argv.slice(2));
const MODE = args.has("--apply") ? "apply" : args.has("--dry-run") ? "dry-run" : "";
if (!MODE) {
  console.error("用法：node scripts/408card/import-cards.mjs --dry-run|--apply");
  process.exit(2);
}

const fingerprint = (obj) => createHash("sha256").update(JSON.stringify(obj)).digest("hex");

async function loadSubject(code) {
  const file = path.join(RAW, "data-" + code + ".js");
  try {
    const text = await readFile(file, "utf8");
    const js = text.replace(/export const points\s*=\s*/, "module.exports = ");
    const tmp = path.join(RAW, "data-" + code + ".cjs");
    await writeFile(tmp, js);
    delete require.cache[tmp];
    return require(tmp);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // 服务器/CI 没有 .local 原始文件：回退到已提交的规范化 JSON（scripts/408card/cards/*.json）
    const normalized = JSON.parse(await readFile(path.join(OUT_DIR, code + ".json"), "utf8"));
    return normalized.map((card) => ({
      id: card.key.replace(/^408card\//, ""),
      ch: card.chapter,
      q: card.question,
      a: card.answerSteps,
      pit: card.pitfall ?? undefined,
      mn: card.mnemonic ?? undefined,
      star: card.star,
      demo: card.demoKey ?? undefined,
    }));
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const all = [];
  for (const [code, subjectKey] of CODES) {
    const points = await loadSubject(code);
    const normalized = points.map((p, index) => ({
      key: "408card/" + p.id,
      subjectKey,
      chapter: Number(p.ch) || 0,
      question: String(p.q || "").trim(),
      answerSteps: Array.isArray(p.a) ? p.a.map((x) => String(x)) : [],
      pitfall: p.pit ? String(p.pit) : null,
      mnemonic: p.mn ? String(p.mn) : null,
      star: Boolean(p.star),
      demoKey: p.demo ? String(p.demo) : null,
      sortOrder: index,
    }));
    await writeFile(path.join(OUT_DIR, code + ".json"), JSON.stringify(normalized, null, 1));
    all.push(...normalized);
    console.log("[cards] " + code + " " + normalized.length + " 张 → scripts/408card/cards/" + code + ".json");
  }
  console.log("[cards] total " + all.length);

  const { Pool } = require("pg");
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
    database: process.env.PGDATABASE || "Learn-Workbench",
  });
  const client = await pool.connect();
  try {
    if (MODE === "dry-run") {
      const { rows } = await client.query("SELECT count(*)::int AS n FROM exam_408_cards");
      console.log("[cards] dry-run：库中现有 " + rows[0].n + " 张，将写入 " + all.length + " 张");
      return;
    }
    await client.query("BEGIN");
    for (const card of all) {
      await client.query(
        "INSERT INTO exam_408_cards (key, source_key, subject_key, chapter, question, answer_steps, pitfall, mnemonic, star, demo_key, sort_order, fingerprint, status) " +
          "VALUES ($1,'408card-top',$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,'published') " +
          "ON CONFLICT (key) DO UPDATE SET subject_key=EXCLUDED.subject_key, chapter=EXCLUDED.chapter, question=EXCLUDED.question, " +
          "answer_steps=EXCLUDED.answer_steps, pitfall=EXCLUDED.pitfall, mnemonic=EXCLUDED.mnemonic, star=EXCLUDED.star, demo_key=EXCLUDED.demo_key, " +
          "sort_order=EXCLUDED.sort_order, fingerprint=EXCLUDED.fingerprint, updated_at=now()",
        [card.key, card.subjectKey, card.chapter, card.question, JSON.stringify(card.answerSteps), card.pitfall, card.mnemonic, card.star, card.demoKey, card.sortOrder, fingerprint(card)],
      );
    }
    await client.query("COMMIT");
    console.log("[cards] 已写入 " + all.length + " 张");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[cards] 失败：" + error.message);
  process.exit(1);
});
