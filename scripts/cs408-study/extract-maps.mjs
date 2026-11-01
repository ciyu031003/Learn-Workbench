#!/usr/bin/env node
/**
 * cs408 章节知识图谱数据抽取（P0.5）
 *
 * 精读正文里的「📊 章节知识图谱」是 iframe：/interactive/knowledge-map.html?data=<JSON>，
 * data 里就是图谱数据 { chapter, nodes:[{slug,title,type:core|ext|viz,desc}], links? }。
 * 本脚本把 61 个 iframe 的数据抽成 scripts/cs408-study/knowledge-maps.json，供入库与双端原生渲染。
 *
 * 用法：node scripts/cs408-study/extract-maps.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SNAPSHOT = path.join(ROOT, "scripts/cs408-study/snapshot.json");
const OUT = path.join(ROOT, "scripts/cs408-study/knowledge-maps.json");

const SUBJECT_MAP = {
  data_structure: "data-structure",
  computer_organization: "computer-organization",
  operating_system: "operating-system",
  computer_network: "computer-network",
};

function parseDataParam(src) {
  const query = src.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const raw = params.get("data");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  const maps = [];
  for (const topic of snapshot.topics) {
    const content = topic.content || "";
    for (const match of content.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
      const src = match[1].replace(/&amp;/g, "&");
      if (!src.includes("/interactive/knowledge-map.html")) continue;
      const data = parseDataParam(src);
      if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) continue;
      const subjectKey = SUBJECT_MAP[topic.subject];
      if (!subjectKey) continue;
      const chapter = String(data.chapter || topic.chapter || "").trim();
      const nodes = data.nodes.map((node, index) => ({
        slug: String(node.slug ?? ""),
        title: String(node.title ?? ""),
        type: ["core", "ext", "viz"].includes(node.type) ? node.type : "core",
        desc: node.desc ? String(node.desc) : "",
        order: index,
      }));
      maps.push({
        key: subjectKey + ":" + chapter,
        topicSlug: topic.slug,
        topicKey: topic.id,
        subjectKey,
        chapter,
        nodes,
        links: Array.isArray(data.links) ? data.links : [],
        sourceUrl: "https://cs408.cloud/study?subject=" + topic.subject + "&topic=" + encodeURIComponent(topic.slug),
      });
    }
  }
  // 同一章节可能重复出现：保留节点最多的那份
  const byKey = new Map();
  for (const map of maps) {
    const existing = byKey.get(map.key);
    if (!existing || map.nodes.length > existing.nodes.length) byKey.set(map.key, map);
  }
  const list = [...byKey.values()];
  await writeFile(OUT, JSON.stringify({ source: "cs408.cloud", capturedAt: new Date().toISOString(), maps: list }, null, 1));
  const nodeTotal = list.reduce((n, m) => n + m.nodes.length, 0);
  console.log("[maps] 章节图谱 " + list.length + " 个 / 节点 " + nodeTotal + " → " + OUT);
  for (const map of list) {
    const core = map.nodes.filter((n) => n.type === "core").length;
    const ext = map.nodes.filter((n) => n.type === "ext").length;
    const viz = map.nodes.filter((n) => n.type === "viz").length;
    console.log("  " + map.key + "  core=" + core + " ext=" + ext + " viz=" + viz);
  }
}

main().catch((error) => {
  console.error("[maps] 失败：" + error.message);
  process.exit(1);
});
