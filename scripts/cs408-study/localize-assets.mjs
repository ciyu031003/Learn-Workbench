#!/usr/bin/env node
/**
 * cs408 快照资产补齐：把正文里剩余的 <img src> / Markdown 图片引用下载到
 * apps/web/public/content-images/cs408/ 并改写为本地路径（幂等，可重复运行）。
 *
 * 用法：node scripts/cs408-study/localize-assets.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = "https://cs408.cloud";
const SNAPSHOT = path.join(ROOT, "scripts/cs408-study/snapshot.json");
const ASSET_DIR = path.join(ROOT, "apps/web/public/content-images/cs408");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const payload = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  await mkdir(ASSET_DIR, { recursive: true });

  const refs = new Set();
  for (const topic of payload.topics) {
    const content = topic.content || "";
    for (const m of content.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) refs.add(m[1]);
    for (const m of content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) refs.add(m[1]);
  }
  const pending = [...refs].filter((u) => u.startsWith("/") && !u.startsWith("/content-images/"));
  console.log("[assets] refs=" + refs.size + " 待本地化=" + pending.length);

  const map = new Map();
  for (const src of pending) {
    const name = path.basename(src);
    const res = await fetch(BASE + src);
    if (!res.ok) {
      console.error("[assets] 下载失败 " + src + " HTTP " + res.status);
      continue;
    }
    await writeFile(path.join(ASSET_DIR, name), Buffer.from(await res.arrayBuffer()));
    map.set(src, "/content-images/cs408/" + name);
    console.log("[assets] " + src + " -> " + name);
    await sleep(120);
  }

  let touched = 0;
  for (const topic of payload.topics) {
    const before = topic.content || "";
    let after = before;
    for (const [src, local] of map) {
      after = after.split(src).join(local);
    }
    if (after !== before) {
      topic.content = after;
      touched += 1;
    }
  }
  if (touched > 0) await writeFile(SNAPSHOT, JSON.stringify(payload, null, 1));
  console.log("[assets] 已下载 " + map.size + " 个，改写 " + touched + " 篇");

  const still = [];
  for (const topic of payload.topics) {
    for (const m of (topic.content || "").matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) if (m[1].startsWith("/") && !m[1].startsWith("/content-images/")) still.push(m[1]);
    for (const m of (topic.content || "").matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) if (m[1].startsWith("/") && !m[1].startsWith("/content-images/")) still.push(m[1]);
  }
  if (still.length) console.log("[assets] 仍有未本地化引用 " + still.length + "：" + still.slice(0, 5).join(", "));
  else console.log("[assets] 全部本地化完成 ✅");
}

main().catch((error) => {
  console.error("[assets] 失败：" + error.message);
  process.exit(1);
});
