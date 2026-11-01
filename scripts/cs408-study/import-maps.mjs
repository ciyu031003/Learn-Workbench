#!/usr/bin/env node
/**
 * 章节知识图谱入库（迁移 088）：knowledge-maps.json → exam_408_knowledge_maps
 *
 * 节点用 slug 回查 exam_408_study_topics（拿到 key/标题/重要度/考频/知识点映射），
 * 再按知识点聚合「卡片/演示/真题」数量，前端直接渲染，无需再跨表查询。
 *
 * 用法：node scripts/cs408-study/import-maps.mjs --dry-run|--apply
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FILE = path.join(ROOT, "scripts/cs408-study/knowledge-maps.json");
const require = createRequire(import.meta.url);

const args = new Set(process.argv.slice(2));
const MODE = args.has("--apply") ? "apply" : args.has("--dry-run") ? "dry-run" : "";
if (!MODE) {
  console.error("用法：node scripts/cs408-study/import-maps.mjs --dry-run|--apply");
  process.exit(2);
}
const fingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function main() {
  const payload = JSON.parse(await readFile(FILE, "utf8"));
  const maps = payload.maps ?? [];
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
    const slugs = [...new Set(maps.flatMap((m) => m.nodes.map((n) => n.slug)))];
    const topics = slugs.length
      ? (await client.query(
          "SELECT key, slug, title, importance, exam_frequency, knowledge_point_key FROM exam_408_study_topics WHERE slug = ANY($1::text[])",
          [slugs],
        )).rows
      : [];
    const bySlug = new Map(topics.map((row) => [row.slug, row]));

    const pointKeys = [...new Set(topics.map((row) => row.knowledge_point_key).filter(Boolean))];
    const counts = new Map();
    if (pointKeys.length) {
      const [cards, demos, questions] = await Promise.all([
        client.query("SELECT knowledge_point_key AS k, count(*)::int AS n FROM exam_408_cards WHERE knowledge_point_key = ANY($1::text[]) GROUP BY 1", [pointKeys]),
        client.query("SELECT knowledge_point_key AS k, count(*)::int AS n FROM exam_408_demos WHERE knowledge_point_key = ANY($1::text[]) GROUP BY 1", [pointKeys]),
        client.query("SELECT knowledge_point_key AS k, count(*)::int AS n FROM exam_408_question_knowledge_points WHERE knowledge_point_key = ANY($1::text[]) GROUP BY 1", [pointKeys]),
      ]);
      for (const row of cards.rows) counts.set(row.k, { ...(counts.get(row.k) ?? { cards: 0, demos: 0, questions: 0 }), cards: row.n });
      for (const row of demos.rows) counts.set(row.k, { ...(counts.get(row.k) ?? { cards: 0, demos: 0, questions: 0 }), demos: row.n });
      for (const row of questions.rows) counts.set(row.k, { ...(counts.get(row.k) ?? { cards: 0, demos: 0, questions: 0 }), questions: row.n });
    }
    const zero = { cards: 0, demos: 0, questions: 0 };

    const enriched = maps.map((map) => ({
      ...map,
      nodes: map.nodes.map((node) => {
        const topic = bySlug.get(node.slug);
        const pointKey = topic?.knowledge_point_key ?? null;
        return {
          ...node,
          title: topic?.title?.replace(/^📊\s*/, "") ?? node.title,
          studyKey: topic?.key ?? null,
          importance: topic?.importance ?? "common",
          examFrequency: topic?.exam_frequency ?? 0,
          pointKey,
          counts: pointKey ? counts.get(pointKey) ?? zero : zero,
        };
      }),
    }));

    console.log("[maps-import] 图谱 " + enriched.length + " 个 / 节点 " + enriched.reduce((n, m) => n + m.nodes.length, 0));
    if (MODE === "dry-run") {
      const { rows } = await client.query("SELECT count(*)::int AS n FROM exam_408_knowledge_maps");
      console.log("[maps-import] dry-run：库中现有 " + rows[0].n + " 个，将写入 " + enriched.length + " 个");
      return;
    }
    await client.query("BEGIN");
    for (const map of enriched) {
      const mapJson = { chapter: map.chapter, nodes: map.nodes };
      await client.query(
        "INSERT INTO exam_408_knowledge_maps (key, topic_key, source_key, subject_key, chapter, map, node_count, fingerprint) " +
          "VALUES ($1,$2,'cs408-cloud',$3,$4,$5::jsonb,$6,$7) " +
          "ON CONFLICT (key) DO UPDATE SET topic_key=EXCLUDED.topic_key, subject_key=EXCLUDED.subject_key, chapter=EXCLUDED.chapter, " +
          "map=EXCLUDED.map, node_count=EXCLUDED.node_count, fingerprint=EXCLUDED.fingerprint, updated_at=now()",
        [map.key, map.topicKey, map.subjectKey, map.chapter, JSON.stringify(mapJson), map.nodes.length, fingerprint(mapJson)],
      );
    }
    await client.query("COMMIT");
    console.log("[maps-import] 已写入 " + enriched.length + " 个章节图谱");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[maps-import] 失败：" + error.message);
  process.exit(1);
});
