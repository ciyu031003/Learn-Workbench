#!/usr/bin/env node
/**
 * cs408.cloud → 本地快照（P0/P3）
 *
 * 站点提供公开 API：GET /api/topics?subject=&page=&pageSize=；GET /api/topics/{id}（含 Markdown 正文）。
 * 授权：作者已同意个人学习、非商业用途；保留署名与原文链接。
 *
 * 输出：
 *   scripts/cs408-study/snapshot.json                     181 篇正文（Markdown，图片路径已本地化）
 *   apps/web/public/content-images/cs408/*.svg            840 张 SVG 插图
 *
 * 用法：node scripts/cs408-study/snapshot.mjs [--limit=5] [--no-assets]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = "https://cs408.cloud";
const OUT = path.join(ROOT, "scripts/cs408-study/snapshot.json");
const ASSET_DIR = path.join(ROOT, "apps/web/public/content-images/cs408");
const SUBJECTS = ["data_structure", "computer_organization", "operating_system", "computer_network"];

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.slice(8)) : 0;
const NO_ASSETS = args.includes("--no-assets");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, retries = 3) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "learn-workbench-content-crawler/1.0 (personal study use)" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(800 * (i + 1));
    }
  }
}

async function main() {
  const list = [];
  for (const subject of SUBJECTS) {
    let page = 1;
    let total = Infinity;
    while (list.filter((t) => t.subject === subject).length < total) {
      const data = await getJson(BASE + "/api/topics?subject=" + subject + "&page=" + page + "&pageSize=20");
      total = data.total ?? 0;
      list.push(...(data.data ?? []));
      if ((data.data ?? []).length === 0 || page > 10) break;
      page += 1;
      await sleep(120);
    }
    process.stdout.write("list " + subject + " total=" + total + " got=" + list.filter((t) => t.subject === subject).length + "\n");
    await sleep(120);
  }

  const uniq = Object.values(Object.fromEntries(list.map((t) => [t.id, t])));
  const slice = LIMIT > 0 ? uniq.slice(0, LIMIT) : uniq;
  const topics = [];
  for (let i = 0; i < slice.length; i += 1) {
    const full = await getJson(BASE + "/api/topics/" + slice[i].id);
    topics.push(full);
    if ((i + 1) % 20 === 0) process.stdout.write("topic " + (i + 1) + "/" + slice.length + "\n");
    await sleep(140);
  }

  // 下载插图并把 Markdown 里的相对路径改写成本地 /content-images/cs408/<file>
  const assets = new Map();
  if (!NO_ASSETS) {
    await mkdir(ASSET_DIR, { recursive: true });
    for (const topic of topics) {
      const refs = [...topic.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
      for (const src of refs) {
        if (!src.startsWith("/")) continue;
        if (!assets.has(src)) assets.set(src, path.basename(src));
      }
    }
    let done = 0;
    for (const [src, name] of assets) {
      const dest = path.join(ASSET_DIR, name);
      try {
        const res = await fetch(BASE + src);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(dest, buf);
      } catch (error) {
        process.stderr.write("asset fail " + src + " " + error.message + "\n");
      }
      done += 1;
      if (done % 50 === 0) process.stdout.write("assets " + done + "/" + assets.size + "\n");
      await sleep(60);
    }
    for (const topic of topics) {
      topic.content = topic.content.replace(/!\[([^\]]*)\]\((\/[^)]+)\)/g, (all, alt, src) => {
        const name = assets.get(src);
        return name ? "![" + alt + "](/content-images/cs408/" + name + ")" : all;
      });
    }
  }

  const payload = {
    source: "cs408.cloud",
    capturedAt: new Date().toISOString(),
    license: "作者已同意：个人学习、非商业用途；保留署名与原文链接。",
    totalTopics: uniq.length,
    assets: Array.from(assets.entries()).map(([src, name]) => ({ src, name })),
    topics,
  };
  await writeFile(OUT, JSON.stringify(payload, null, 1));
  process.stdout.write("snapshot " + topics.length + " topics, " + assets.size + " assets -> " + OUT + "\n");
}

main().catch((error) => {
  console.error("snapshot failed:", error.message);
  process.exit(1);
});
