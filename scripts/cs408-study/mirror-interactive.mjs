#!/usr/bin/env node
/**
 * cs408 交互可视化页静态镜像（去掉精读里的外链 iframe）
 *
 * 用法：
 *   node scripts/cs408-study/mirror-interactive.mjs            # 镜像 assets + 改写 snapshot.json 的 iframe src（幂等）
 *   node scripts/cs408-study/mirror-interactive.mjs --check    # 只校验：镜像缺失/快照未改写/仍有外链时退出码 1
 *   node scripts/cs408-study/mirror-interactive.mjs --no-snapshot   # 只镜像 assets
 *
 * 做什么：
 *   1) 从 snapshot.json 里收集 /interactive/<name>.html 的 iframe 引用（章节知识图谱 knowledge-map 不在本脚本范围）；
 *   2) 下载每个页面，并把页面引用的同源资源（相对 /interactive/ 的 js/css/图片/font/html）一并下载；
 *   3) 落盘到 apps/web/public/content-interactive/<name>/（保留原相对结构，index.html 为入口）；
 *      页面里所有绝对 /interactive/xxx 引用改写为相对路径（结构保留，相对引用天然仍然有效）；
 *   4) 写清单 scripts/cs408-study/interactive-manifest.json（slug/title/本地路径/文件数/大小/sha256）；
 *   5) 把 snapshot.json 里这些 iframe 的 src 改写为 /content-interactive/<name>/index.html（只动 iframe 的 src）。
 *
 * 幂等：文件内容相同不重写；二次运行会报告 written=0 / snapshot changed=0。
 * 说明：这些页面都是单文件（内联 CSS/JS/SVG），引用的外链数为 0；脚本仍保留通用的同源资源下载与改写逻辑，
 *       以防上游以后拆出 shared.js / assets。
 * 授权：cs408.cloud 作者已同意「个人学习、非商业用途」，保留署名与来源 URL（清单里记录）。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SNAPSHOT = path.join(ROOT, "scripts/cs408-study/snapshot.json");
const MANIFEST = path.join(ROOT, "scripts/cs408-study/interactive-manifest.json");
const OUT_DIR = path.join(ROOT, "apps/web/public/content-interactive");

const BASE = (process.env.CS408_BASE || "https://cs408.cloud").replace(/\/$/, "");
const LOCAL_PREFIX = "/content-interactive/";
const INTERACTIVE_PREFIX = "/interactive/";
const MANIFEST_PREFIX = "scripts/cs408-study/interactive-manifest.json";

const args = new Set(process.argv.slice(2));
const MODE = args.has("--check") ? "check" : "mirror";
const TOUCH_SNAPSHOT = !args.has("--no-snapshot");

const USER_AGENT = "Mozilla/5.0 (Learn-Workbench; cs408 static mirror)";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ASSET_EXT = new Set([
  ".html", ".htm", ".js", ".mjs", ".cjs", ".css", ".json", ".map", ".txt",
  ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".avif",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp4", ".webm", ".mp3", ".wav",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function posixJoin(...parts) {
  const joined = parts.filter(Boolean).join("/").replace(/\/{2,}/g, "/");
  return path.posix.normalize(joined.startsWith("/") ? joined : "/" + joined);
}

function splitRef(ref) {
  const hashIndex = ref.indexOf("#");
  const withoutHash = hashIndex >= 0 ? ref.slice(0, hashIndex) : ref;
  const queryIndex = withoutHash.indexOf("?");
  return {
    pathPart: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
    query: queryIndex >= 0 ? withoutHash.slice(queryIndex) : "",
    hash: hashIndex >= 0 ? ref.slice(hashIndex) : "",
  };
}

/** 页面里出现资源引用的地方：src/href/poster/srcset、CSS url()、@import、以及 JS 字符串里的 /interactive/ 绝对路径。 */
function collectRefs(text) {
  const refs = new Set();
  for (const match of text.matchAll(/(?:\bsrc|\bhref|\bposter)\s*=\s*["']([^"']+)["']/gi)) refs.add(match[1]);
  for (const match of text.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of match[1].split(",")) {
      const candidate = part.trim().split(/\s+/)[0];
      if (candidate) refs.add(candidate);
    }
  }
  for (const match of text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) refs.add(match[2].trim());
  for (const match of text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/gi)) refs.add(match[1]);
  for (const match of text.matchAll(/["'\`](\/interactive\/[^"'\`\s]+)["'\`]/g)) refs.add(match[1]);
  return refs;
}

/** 引用 → 同源可下载的目标路径；不可本地化时返回 null 并归类（external / fragment / skip）。 */
function classifyRef(ref, fromPath) {
  const raw = String(ref ?? "").trim();
  if (!raw) return { kind: "skip" };
  if (raw.startsWith("#")) return { kind: "skip" };
  if (/^(?:data|blob|mailto|tel|javascript|about):/i.test(raw)) return { kind: "skip" };
  if (raw.startsWith("//")) return { kind: "external", ref: raw };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return { kind: "external", ref: raw };

  const { pathPart, query, hash } = splitRef(raw);
  if (!pathPart) return { kind: "skip" };
  const absolute = pathPart.startsWith("/");
  const target = absolute ? posixJoin(pathPart) : posixJoin(path.posix.dirname(fromPath), pathPart);
  const ext = path.posix.extname(target).toLowerCase();
  return { kind: "same-origin", ref: raw, absolute, target, query, hash, ext };
}

async function fetchBinary(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(300 * attempt);
    }
  }
  throw new Error("下载失败 " + url + "：" + (lastError?.message ?? "unknown"));
}

/**
 * 收集 snapshot 里属于本脚本范围的 iframe 页面（排除 knowledge-map 这类由其它管线处理的图谱）。
 * 同时接受「原始外链」与「已本地化」两种 src，保证二次运行仍能重建同一份清单（幂等）。
 */
function collectPages(payload) {
  const pages = new Map();
  for (const topic of payload.topics ?? []) {
    const content = String(topic.content ?? "");
    for (const match of content.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      const tag = match[0];
      const src = match[1];
      const { pathPart } = splitRef(src);
      let name = null;
      let sourcePath = null;
      if (pathPart.startsWith(INTERACTIVE_PREFIX)) {
        const fileName = pathPart.slice(INTERACTIVE_PREFIX.length);
        if (!fileName.endsWith(".html")) continue;
        if (/^knowledge-map\.html$/i.test(fileName)) continue;
        name = fileName.slice(0, -".html".length);
        sourcePath = pathPart;
      } else if (pathPart.startsWith(LOCAL_PREFIX)) {
        const rest = pathPart.slice(LOCAL_PREFIX.length);
        const segment = rest.split("/")[0];
        if (!segment || !rest.endsWith("/index.html")) continue;
        name = segment;
        sourcePath = INTERACTIVE_PREFIX + name + ".html";
      } else {
        continue;
      }
      const titleMatch = /\btitle\s*=\s*["']([^"']+)["']/i.exec(tag);
      const entry = pages.get(name) ?? {
        name,
        slug: name,
        title: titleMatch?.[1] ?? name,
        sourcePath,
        localPath: LOCAL_PREFIX + name + "/index.html",
        usedBy: new Set(),
      };
      if (titleMatch?.[1]) entry.title = titleMatch[1];
      entry.usedBy.add(String(topic.slug ?? ""));
      pages.set(name, entry);
    }
  }
  return pages;
}

/** 逐页镜像：下载入口 html + 它引用的同源资源（递归一层以上）。 */
async function mirrorPage(page) {
  const files = new Map(); // relPath → Buffer
  const externalRefs = new Set();
  const siteRefs = new Set();
  const queue = [page.sourcePath.slice(INTERACTIVE_PREFIX.length)];
  const downloaded = new Set();

  while (queue.length > 0) {
    const rel = queue.shift();
    if (downloaded.has(rel)) continue;
    downloaded.add(rel);
    const sourcePath = INTERACTIVE_PREFIX + rel;
    const buffer = await fetchBinary(BASE + sourcePath);
    files.set(rel, buffer);
    const ext = path.posix.extname(rel).toLowerCase();
    const textLike = ext === ".html" || ext === ".htm" || ext === ".css" || ext === ".js" || ext === ".mjs" || ext === ".json" || ext === ".svg";
    if (!textLike) continue;
    const text = buffer.toString("utf8");
    for (const ref of collectRefs(text)) {
      const info = classifyRef(ref, sourcePath);
      if (info.kind === "external") {
        externalRefs.add(info.ref);
        continue;
      }
      if (info.kind !== "same-origin") continue;
      if (info.target.startsWith(INTERACTIVE_PREFIX)) {
        const targetRel = info.target.slice(INTERACTIVE_PREFIX.length);
        if (!ASSET_EXT.has(path.posix.extname(targetRel).toLowerCase())) continue;
        if (!downloaded.has(targetRel)) queue.push(targetRel);
      } else if (info.target !== sourcePath) {
        siteRefs.add(info.target);
      }
    }
    await sleep(60);
  }

  // 绝对 /interactive/ 引用 → 相对当前文件的本地路径（保留目录结构，相对引用天然有效）
  const rewrite = (rel, text) => {
    const dir = path.posix.dirname(rel);
    return text.replace(/\/interactive\/([A-Za-z0-9._\-/]+\.(?:html?|m?js|cjs|css|json|map|txt|svg|png|jpe?g|webp|gif|ico|avif|woff2?|ttf|otf|eot|mp4|webm|mp3|wav))(?:\?[^"'\`)\s<]*)?/g, (_match, targetRel) => {
      const relative = path.posix.relative(dir === "." ? "" : dir, targetRel);
      return relative.startsWith(".") ? relative : "./" + relative;
    });
  };

  const fileEntries = [];
  for (const [rel, buffer] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ext = path.posix.extname(rel).toLowerCase();
    const isText = ext === ".html" || ext === ".htm" || ext === ".css" || ext === ".js" || ext === ".mjs" || ext === ".svg";
    const finalBuffer = isText ? Buffer.from(rewrite(rel, buffer.toString("utf8")), "utf8") : buffer;
    const outPath = rel === page.sourcePath.slice(INTERACTIVE_PREFIX.length) ? "index.html" : rel;
    fileEntries.push({ path: outPath, buffer: finalBuffer, bytes: finalBuffer.byteLength, sha256: sha256(finalBuffer) });
  }

  return {
    files: fileEntries,
    externalRefs: [...externalRefs].sort(),
    siteRefs: [...siteRefs].sort(),
  };
}

async function writeIfChanged(absolutePath, buffer) {
  if (existsSync(absolutePath)) {
    const existing = await readFile(absolutePath);
    if (existing.equals(buffer)) return "unchanged";
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return "written";
}

async function main() {
  const payload = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  const pages = collectPages(payload);
  console.log("[interactive] snapshot 里命中 " + pages.size + " 个交互页面（knowledge-map 不在本脚本范围）");

  const manifestPages = [];
  let writtenFiles = 0;
  let unchangedFiles = 0;
  const problems = [];
  const externalAll = new Set();
  const siteRefsAll = new Map();

  for (const page of [...pages.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const mirrored = await mirrorPage(page);
    for (const ref of mirrored.externalRefs) externalAll.add(ref);
    for (const ref of mirrored.siteRefs) siteRefsAll.set(ref, (siteRefsAll.get(ref) ?? 0) + 1);
    const entries = [];
    let totalBytes = 0;
    for (const file of mirrored.files) {
      const outPath = path.join(OUT_DIR, page.name, file.path);
      const state = MODE === "check" ? (existsSync(outPath) ? "unchanged" : "missing") : await writeIfChanged(outPath, file.buffer);
      if (state === "written") writtenFiles += 1;
      else if (state === "unchanged") unchangedFiles += 1;
      else problems.push("缺少镜像文件 " + page.name + "/" + file.path);
      entries.push({ path: file.path, bytes: file.bytes, sha256: file.sha256 });
      totalBytes += file.bytes;
    }
    manifestPages.push({
      name: page.name,
      slug: page.slug,
      title: page.title,
      sourceUrl: BASE + page.sourcePath,
      localPath: page.localPath,
      usedBy: [...page.usedBy].filter(Boolean).sort(),
      fileCount: entries.length,
      totalBytes,
      files: entries,
    });
    await sleep(80);
  }

  const totals = {
    pages: manifestPages.length,
    files: manifestPages.reduce((sum, page) => sum + page.fileCount, 0),
    bytes: manifestPages.reduce((sum, page) => sum + page.totalBytes, 0),
    externalRefs: externalAll.size,
  };
  const manifest = {
    generatedBy: "scripts/cs408-study/mirror-interactive.mjs",
    base: BASE,
    license: "作者已同意：个人学习、非商业用途；本地静态镜像，保留署名与来源 URL。",
    totals,
    pages: manifestPages,
  };
  const manifestText = JSON.stringify(manifest, null, 1);
  const manifestChanged = MODE === "check" ? false : (await writeIfChanged(MANIFEST, Buffer.from(manifestText, "utf8"))) === "written";
  console.log(
    "[interactive] 镜像完成：pages=" + totals.pages + " files=" + totals.files + " bytes=" + totals.bytes + " (" + (totals.bytes / 1024).toFixed(1) + " KB)" +
      " written=" + writtenFiles + " unchanged=" + unchangedFiles,
  );
  if (siteRefsAll.size > 0) {
    console.log("[interactive] 站点内其它绝对引用（已在 public 里，未下载）：");
    for (const [ref, count] of [...siteRefsAll.entries()].sort()) console.log("  - " + ref + " ×" + count);
  }
  if (externalAll.size > 0) {
    console.error("[interactive] ⚠️ 仍有外链引用（需人工处理）：");
    for (const ref of [...externalAll].sort()) console.error("  - " + ref);
  }

  // 改写 snapshot 的 iframe src（只动命中的 /interactive/<name>.html）
  let snapshotChanged = 0;
  if (TOUCH_SNAPSHOT) {
    const names = new Set([...pages.keys()]);
    const iframeRe = /(<iframe\b[^>]*?\bsrc\s*=\s*["'])(\/interactive\/([A-Za-z0-9._-]+)\.html)(?:\?[^"']*)?(["'])/gi;
    let touchedTopics = 0;
    for (const topic of payload.topics ?? []) {
      const before = String(topic.content ?? "");
      const after = before.replace(iframeRe, (match, prefix, _path, name, suffix) => {
        if (!names.has(name)) return match;
        snapshotChanged += 1;
        return prefix + LOCAL_PREFIX + name + "/index.html" + suffix;
      });
      if (after !== before) {
        topic.content = after;
        touchedTopics += 1;
      }
    }
    console.log("[interactive] snapshot iframe src：改写 " + snapshotChanged + " 处（涉及 " + touchedTopics + " 篇）");
    if (MODE === "check") {
      if (snapshotChanged > 0) problems.push("snapshot.json 里仍有 " + snapshotChanged + " 个外链式 iframe src 未改写");
    } else if (touchedTopics > 0) {
      await writeFile(SNAPSHOT, JSON.stringify(payload, null, 1));
    }
  }

  // 校验：镜像文件与 manifest 是否存在、页面里是否还有 https://cs408.cloud 外链
  if (MODE === "check") {
    if (manifestChanged) problems.push("interactive-manifest.json 需要更新：" + MANIFEST_PREFIX);
    for (const page of manifestPages) {
      const entry = path.join(OUT_DIR, page.name, "index.html");
      if (!existsSync(entry)) problems.push("缺少入口 " + page.localPath);
      else {
        const text = await readFile(entry, "utf8");
        if (text.includes("cs408.cloud")) problems.push(page.name + "/index.html 里仍有 cs408.cloud 外链");
      }
    }
  }

  if (problems.length > 0) {
    console.error("[interactive] ❌ 校验未通过（" + problems.length + " 项）：");
    for (const problem of problems) console.error("  - " + problem);
    process.exitCode = 1;
    return;
  }
  console.log("[interactive] ✅ 完成：assets + manifest" + (TOUCH_SNAPSHOT ? " + snapshot iframe src 已本地化" : ""));
  if (TOUCH_SNAPSHOT && snapshotChanged > 0 && MODE !== "check") {
    console.log("[interactive] 下一步：node scripts/cs408-study/import.mjs --apply   # 把改后的正文重导入 exam_408_study_topics");
  }
}

main().catch((error) => {
  console.error("[interactive] 失败：" + error.message);
  process.exit(1);
});
