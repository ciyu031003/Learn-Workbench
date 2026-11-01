#!/usr/bin/env node
/**
 * cs408 快照 → exam_408_study_topics（P0/P3）
 *
 * 用法：
 *   node scripts/cs408-study/import.mjs --dry-run
 *   node scripts/cs408-study/import.mjs --apply
 *
 * 连接：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD（默认 127.0.0.1/Learn-Workbench/postgres）。
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SNAPSHOT = path.join(ROOT, "scripts/cs408-study/snapshot.json");
const require = createRequire(import.meta.url);

const SUBJECT_MAP = {
  data_structure: "data-structure",
  computer_organization: "computer-organization",
  operating_system: "operating-system",
  computer_network: "computer-network",
};

/** 章节标题 → 专区章节 key 前缀（用于映射知识点）；未命中则留空。 */
const CHAPTER_MAP = {
  "data-structure": {
    绪论: "ds-01",
    线性表: "ds-02",
    线性数据结构: "ds-03",
    字符串: "ds-03",
    树与二叉树: "ds-04",
    图: "ds-05",
    查找: "ds-06",
    排序: "ds-07",
  },
  "computer-organization": {
    计算机系统概述: "co-01",
    "数据的表示和运算": "co-02",
    存储器层次结构: "co-03",
    指令系统: "co-04",
    中央处理器: "co-05",
    "总线系统": "co-06",
    总线: "co-06",
    "输入/输出系统": "co-07",
    输入输出系统: "co-07",
  },
  "operating-system": {
    "操作系统概述": "os-01",
    操作系统基础: "os-01",
    进程管理: "os-02",
    内存管理: "os-03",
    文件管理: "os-04",
    "输入/输出管理": "os-05",
    输入输出管理: "os-05",
  },
  "computer-network": {
    计算机网络体系结构: "cn-01",
    物理层: "cn-02",
    数据链路层: "cn-03",
    网络层: "cn-04",
    传输层: "cn-05",
    应用层: "cn-06",
  },
};

const args = new Set(process.argv.slice(2));
const MODE = args.has("--apply") ? "apply" : args.has("--dry-run") ? "dry-run" : "";
if (!MODE) {
  console.error("用法：node scripts/cs408-study/import.mjs --dry-run|--apply");
  process.exit(2);
}

const fingerprint = (text) => createHash("sha256").update(text).digest("hex");

async function main() {
  const payload = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  const rows = [];
  for (const topic of payload.topics) {
    const subjectKey = SUBJECT_MAP[topic.subject];
    if (!subjectKey) continue;
    const chapterPrefix = CHAPTER_MAP[subjectKey]?.[topic.chapter] ?? null;
    rows.push({
      key: topic.id,
      subjectKey,
      chapter: topic.chapter,
      chapterOrder: topic.chapter_order ?? 0,
      title: topic.title,
      slug: topic.slug,
      contentMd: topic.content,
      importance: topic.importance ?? "common",
      examFrequency: topic.exam_frequency ?? 0,
      tags: topic.tags ?? [],
      related: topic.related_topic_ids ?? [],
      chapterPrefix,
      sourceUrl: "https://cs408.cloud/study?subject=" + topic.subject + "&topic=" + encodeURIComponent(topic.slug),
      fingerprint: fingerprint(topic.content),
    });
  }
  console.log("[cs408-import] topics=" + rows.length + " chars=" + rows.reduce((n, r) => n + r.contentMd.length, 0));

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
      const { rows: existing } = await client.query("SELECT count(*)::int AS n FROM exam_408_study_topics");
      console.log("[cs408-import] dry-run：库中现有 " + existing[0].n + " 篇，将写入 " + rows.length + " 篇");
      return;
    }
    await client.query("BEGIN");
    let n = 0;
    for (const row of rows) {
      await client.query(
        "INSERT INTO exam_408_study_topics (key, source_key, subject_key, chapter, chapter_order, title, slug, content_md, importance, exam_frequency, tags, related_topic_ids, source_url, fingerprint, status) " +
          "VALUES ($1,'cs408-cloud',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,'published') " +
          "ON CONFLICT (key) DO UPDATE SET subject_key=EXCLUDED.subject_key, chapter=EXCLUDED.chapter, chapter_order=EXCLUDED.chapter_order, " +
          "title=EXCLUDED.title, slug=EXCLUDED.slug, content_md=EXCLUDED.content_md, importance=EXCLUDED.importance, exam_frequency=EXCLUDED.exam_frequency, " +
          "tags=EXCLUDED.tags, related_topic_ids=EXCLUDED.related_topic_ids, source_url=EXCLUDED.source_url, fingerprint=EXCLUDED.fingerprint, updated_at=now()",
        [row.key, row.subjectKey, row.chapter, row.chapterOrder, row.title, row.slug, row.contentMd, row.importance, row.examFrequency, JSON.stringify(row.tags), JSON.stringify(row.related), row.sourceUrl, row.fingerprint],
      );
      n += 1;
    }
    await client.query("COMMIT");
    console.log("[cs408-import] 已写入 " + n + " 篇");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[cs408-import] 失败：" + error.message);
  process.exit(1);
});
