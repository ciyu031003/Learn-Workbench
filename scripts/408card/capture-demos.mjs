#!/usr/bin/env node
/**
 * 408card.top 98 个交互演示 → 步骤 explain + 逐帧截图（P1/P2）
 *
 * 站点静态模块：/js/demos/index.js 导出 mountDemo(host,id)；每个 demo 的工厂函数返回
 * createPlayer(...) 播放器，播放器上 setSteps() 后可按步 paint。本脚本：
 *   1) 下载 demos/index.js 及其相对依赖（demos/*.js、util.js、ui.js）到本地 harness；
 *   2) 给 createPlayer 的返回值补 go()/getSteps() 两个只读钩子（只改本地抓帧副本）；
 *   3) 用本地静态服务器 + Playwright(本机 Chrome) 逐个演示、逐步骤调用 go(i)，
 *      截取“舞台”区域为 PNG，再用 sharp 压成 webp（单帧 <80KB）；
 *   4) 写 apps/web/public/content-demos/<demo>/<n>.webp 与 scripts/408card/demos.json。
 *
 * 授权：作者已同意个人学习、非商业用途；保留署名与来源链接。
 *
 * 帧规格：舞台区域宽 720px、webp quality≈70（自适应降到 46）、单帧目标 ≤15KB（硬上限 80KB）。
 *
 * 用法：
 *   node scripts/408card/capture-demos.mjs                    # 全部 98 个演示
 *   node scripts/408card/capture-demos.mjs --only=ds          # 只抓某几科（ds/co/os/cn，可逗号分隔）
 *   node scripts/408card/capture-demos.mjs --only=sort-bubble # --only 也接受演示 id
 *   node scripts/408card/capture-demos.mjs --resume           # 已有完整帧的演示跳过（增量补抓）
 *   node scripts/408card/capture-demos.mjs --force            # 强制重抓选中演示（忽略 --resume）
 *   node scripts/408card/capture-demos.mjs --limit=2          # 调试：只抓前 N 个
 *   node scripts/408card/capture-demos.mjs --max-steps=40     # 帧太多时均匀抽样到 N 帧
 *   node scripts/408card/capture-demos.mjs --measure          # 只统计每个演示的步数，不截图
 *   node scripts/408card/capture-demos.mjs --keep             # 保留 harness 目录
 *
 * 产物：apps/web/public/content-demos/<id>/<n>.webp（.gitignore 已忽略，部署走资产包）
 *      + scripts/408card/demos.json（catalog 元信息 + steps[{explain,frame}] + frameCount + 总大小统计）
 *
 * 环境变量：DEMO_BASE_URL（默认 https://408card.top/）、CHROME_PATH（默认本机 Chrome）
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const BASE = process.env.DEMO_BASE_URL || "https://408card.top/";
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_JSON = path.join(ROOT, "scripts/408card/demos.json");
const OUT_FRAMES = path.join(ROOT, "apps/web/public/content-demos");
const MIN_STEPS = 3;
const MAX_FRAME_BYTES = 80 * 1024;
/** 目标单帧大小：720px 宽 + quality 70 时一般 6-12KB；超过 15KB 视为需要降质 */
const TARGET_FRAME_BYTES = 15 * 1024;
const FRAME_WIDTH = 720;
const FRAME_QUALITY = Number(process.env.FRAME_QUALITY || 70);
const FRAME_SCALE = Number(process.env.FRAME_SCALE || 1);
const SUBJECT_CODES = new Set(["ds", "co", "os", "cn"]);

/** 专区科目 key（与 exam_408_subjects.key 一致） */
const SUBJECT_KEYS = {
  ds: "beokayy-408/data-structure",
  co: "beokayy-408/computer-organization",
  os: "beokayy-408/operating-system",
  cn: "beokayy-408/computer-network",
};

const args = new Set(process.argv.slice(2));
const argValue = (name, fallback = "") => {
  const hit = process.argv.find((item) => item.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const ONLY_VALUES = argValue("only", "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const ONLY_SUBJECTS = new Set(ONLY_VALUES.filter((value) => SUBJECT_CODES.has(value)));
const ONLY_IDS = new Set([
  ...ONLY_VALUES.filter((value) => !SUBJECT_CODES.has(value)),
  ...argValue("ids", "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
]);
const LIMIT = Number(argValue("limit", "0")) || 0;
const KEEP = args.has("--keep");
const MEASURE = args.has("--measure");
const MAX_STEPS = Number(argValue("max-steps", "0")) || 0;
const RESUME = args.has("--resume");
const FORCE = args.has("--force");

const log = (...items) => console.log("[demos]", ...items);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* 1. 下载站点静态模块                                                 */
/* ------------------------------------------------------------------ */

async function fetchText(relPath) {
  const url = new URL(relPath, BASE).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return await res.text();
}

/** 从入口模块出发，递归下载相对 import 的模块（目录保持站点相对路径）。 */
async function downloadModules(entry) {
  const files = new Map();
  const queue = [entry];
  while (queue.length) {
    const rel = queue.shift();
    if (files.has(rel)) continue;
    const text = await fetchText(rel);
    files.set(rel, text);
    const re = /(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g;
    let match;
    while ((match = re.exec(text))) {
      const resolved = new URL(match[1], "http://local/" + rel).pathname.replace(/^\//, "");
      if (!files.has(resolved)) queue.push(resolved);
    }
    log("下载模块", rel, "(" + text.length + " 字节)");
  }
  return files;
}

/** 只为抓帧：给 createPlayer 返回值补 go/getSteps 钩子。 */
function patchIndexModule(source) {
  const marker = "    getStage: () => stage,";
  if (!source.includes(marker)) {
    throw new Error("demos/index.js 结构与预期不符：找不到 getStage 返回字段");
  }
  let patched = source.replace(
    marker,
    marker + "\n    go,\n    getSteps: () => steps,\n    getIndex: () => idx,",
  );
  // 有些 demo 的工厂函数返回的是 cleanup 函数而不是播放器，这里把 createPlayer 的实例挂到 window，
  // 抓帧脚本即可从 window.__lastCreatedPlayer 读取步骤（不改站点源码语义）。
  patched = patched.replace(
    "  return {\n    setSteps(list) {",
    "  const __api = {\n    setSteps(list) {",
  );
  if (patched === source) {
    throw new Error("demos/index.js 结构与预期不符：找不到 createPlayer 的 return 对象");
  }
  const tailMarker = "      window.removeEventListener('keydown', onKey);\n    },\n  };\n}\n";
  if (!patched.includes(tailMarker)) {
    throw new Error("demos/index.js 结构与预期不符：createPlayer 结尾定位失败");
  }
  patched = patched.replace(
    tailMarker,
    "      window.removeEventListener('keydown', onKey);\n    },\n  };\n  window.__lastCreatedPlayer = __api;\n  return __api;\n}\n",
  );
  return patched + "\n// patched by scripts/408card/capture-demos.mjs（仅本地抓帧副本）\n";
}

/* ------------------------------------------------------------------ */
/* 2. 解析演示目录（data-index.js 的 DEMO_CATALOG）                    */
/* ------------------------------------------------------------------ */

function parseCatalog(source) {
  const start = source.indexOf("export const DEMO_CATALOG");
  if (start < 0) throw new Error("data-index.js 中找不到 DEMO_CATALOG");
  const tail = source.slice(start);
  const end = tail.indexOf("const LOADERS");
  const body = end > 0 ? tail.slice(0, end) : tail;
  const catalog = [];
  const blockRe = /^\s{2}(ds|co|os|cn):\s*\[([\s\S]*?)^\s{2}\],?\s*$/gm;
  let block;
  while ((block = blockRe.exec(body))) {
    const code = block[1];
    const list = [];
    const itemRe = /\{\s*id:\s*'([^']+)'\s*,\s*t:\s*'([^']*)'\s*,\s*d:\s*'([^']*)'\s*[,}]/g;
    let item;
    while ((item = itemRe.exec(block[2]))) {
      list.push({ id: item[1], title: item[2], description: item[3] });
    }
    if (list.length === 0) throw new Error("演示目录 " + code + " 解析为空");
    list.forEach((demo, index) =>
      catalog.push({
        id: demo.id,
        title: demo.title,
        description: demo.description,
        code,
        subjectKey: SUBJECT_KEYS[code],
        sortOrder: index + 1,
      }),
    );
  }
  if (catalog.length === 0) throw new Error("DEMO_CATALOG 解析为空");
  const ids = new Set(catalog.map((demo) => demo.id));
  if (ids.size !== catalog.length) throw new Error("演示目录存在重复 id");
  return catalog;
}

/* ------------------------------------------------------------------ */
/* 3. 生成本地 harness                                                  */
/* ------------------------------------------------------------------ */

const HARNESS_HTML = [
  "<!doctype html>",
  '<html lang="zh-CN" data-theme="light">',
  "<head>",
  '<meta charset="utf-8" />',
  '<link rel="stylesheet" href="/css/app.css" />',
  '<link rel="stylesheet" href="/vendor/katex.min.css" />',
  '<script src="/vendor/marked.min.js"></script>',
  '<script src="/vendor/katex.min.js"></script>',
  "<style>",
  "  html, body { background: #ffffff !important; }",
  "  body { margin: 0; padding: 0; }",
  "  #capture-root {",
  "    width: 720px;",
  "    min-height: 380px;",
  "    padding: 14px 16px 18px;",
  "    box-sizing: border-box;",
  "    overflow: hidden;",
  "    background: var(--card, #fff);",
  "  }",
  "  /* 只保留演示舞台（stage + extras），隐藏控制条、说明文字与快捷键提示 */",
  '  .player-bar, .explain, .player > div[style*="margin-top:6px"] { display: none !important; }',
  "  .stage { min-height: 320px; }",
  "  *, *::before, *::after { animation: none !important; transition: none !important; }",
  "</style>",
  "</head>",
  "<body>",
  '<div id="capture-root"><div id="demo-host"></div></div>',
  '<script type="module">',
  '  import { mountDemo } from "/js/demos/index.js";',
  "",
  '  const host = document.getElementById("demo-host");',
  "  window.__playerApi = null;",
  "  window.__lastCreatedPlayer = null;",
  "  window.__mount = (id) => {",
  "    const previous = window.__playerApi;",
  "    if (previous && typeof previous.destroy === 'function') {",
  "      try { previous.destroy(); } catch (error) {}",
  "    }",
  "    window.__playerApi = null;",
  "    window.__lastCreatedPlayer = null;",
  '    host.innerHTML = "";',
  "    const mounted = mountDemo(host, id, {});",
  "    const api =",
  "      mounted && typeof mounted.getSteps === 'function'",
  "        ? mounted",
  "        : window.__lastCreatedPlayer && typeof window.__lastCreatedPlayer.getSteps === 'function'",
  "          ? window.__lastCreatedPlayer",
  "          : null;",
  "    window.__playerApi = api;",
  '    if (!api) return { ok: false, steps: [], reason: "mountDemo returned no player" };',
  "    const explains = api",
  "      .getSteps()",
  '      .map((step) => String((step && (step.explain || step.text || step.title)) || ""));',
  '    if (!explains.length) return { ok: false, steps: [], reason: "empty steps" };',
  "    return { ok: true, steps: explains };",
  "  };",
  "  window.__show = async (index) => {",
  "    const player = window.__playerApi;",
  '    if (player && typeof player.go === "function") {',
  "      player.go(index);",
  "    } else {",
  '      const buttons = Array.from(document.querySelectorAll(".player-bar button"));',
  '      const next = buttons.find((button) => button.textContent.includes("单步"));',
  '      const reset = buttons.find((button) => button.textContent.includes("重置"));',
  '      if (!next) return "";',
  "      if (reset) reset.click();",
  "      for (let i = 0; i < index; i += 1) next.click();",
  "    }",
  "    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));",
  "    await new Promise((resolve) => setTimeout(resolve, 40));",
  "  };",
  "  window.__explain = () => {",
  '    const node = document.querySelector(".explain");',
  "    return node ? node.textContent : \"\";",
  "  };",
  "  window.__ready = true;",
  "</script>",
  "</body>",
  "</html>",
].join("\n");

async function buildHarness(dir, { modules, dataIndexSource, css, vendors }) {
  await mkdir(path.join(dir, "js", "demos"), { recursive: true });
  await mkdir(path.join(dir, "css"), { recursive: true });
  await mkdir(path.join(dir, "vendor"), { recursive: true });
  for (const [rel, text] of modules) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    const body = rel === "js/demos/index.js" ? patchIndexModule(text) : text;
    await writeFile(abs, body, "utf8");
  }
  await writeFile(path.join(dir, "css", "app.css"), css, "utf8");
  for (const [rel, text] of vendors) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, text, "utf8");
  }
  await writeFile(path.join(dir, "js", "data-index.js"), dataIndexSource, "utf8");
  await writeFile(path.join(dir, "index.html"), HARNESS_HTML, "utf8");
}

/** 极简静态服务器：只服务 harness 目录内文件。 */
function serve(dir) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".png": "image/png",
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
      const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
      const abs = path.resolve(dir, rel);
      if (!abs.startsWith(path.resolve(dir) + path.sep)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const data = await readFile(abs);
      res.writeHead(200, {
        "content-type": types[path.extname(abs).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: "http://127.0.0.1:" + port + "/",
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* 4. 抓帧                                                              */
/* ------------------------------------------------------------------ */

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};
function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

async function shrinkFrame(pngBuffer, sharp) {
  const base = sharp(pngBuffer).flatten({ background: "#ffffff" });
  const meta = await base.metadata();
  let image = base;
  if (meta.width && meta.width > FRAME_WIDTH) {
    image = image.resize({ width: FRAME_WIDTH, withoutEnlargement: true });
  }
  if (meta.height && meta.height > 1400) image = image.resize({ height: 1400 });
  let last = null;
  for (const quality of [FRAME_QUALITY, 64, 58, 52, 46]) {
    last = await image.webp({ quality, effort: 2 }).toBuffer();
    if (last.length <= TARGET_FRAME_BYTES) return last;
  }
  for (const width of [640, 560, 480]) {
    last = await image.resize({ width }).webp({ quality: 46, effort: 2 }).toBuffer();
    if (last.length <= TARGET_FRAME_BYTES) return last;
  }
  // 极端长图（如协议栈总表）再压一档，保证单帧 ≤15KB 的目标。
  if (last.length > TARGET_FRAME_BYTES) {
    last = await image.resize({ width: 420 }).webp({ quality: 40, effort: 2 }).toBuffer();
  }
  return last;
}

function fingerprintOf(entry) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        steps: entry.steps,
      }),
    )
    .digest("hex");
}

async function main() {
  const sharp = require("sharp");
  const { chromium } = require("playwright");

  log("下载站点资源…");
  const modules = await downloadModules("js/demos/index.js");
  const dataIndexSource = await fetchText("js/data-index.js");
  const css = await fetchText("css/app.css");
  const vendors = new Map();
  for (const rel of ["vendor/katex.min.js", "vendor/katex.min.css", "vendor/marked.min.js"]) {
    vendors.set(rel, await fetchText(rel));
    log("下载资源", rel);
  }
  const catalog = parseCatalog(dataIndexSource);
  const bySubject = catalog.reduce((acc, demo) => {
    acc[demo.code] = (acc[demo.code] || 0) + 1;
    return acc;
  }, {});
  log(
    "演示目录：",
    catalog.length,
    "个（" + Object.entries(bySubject).map(([code, n]) => code + ":" + n).join(" ") + "）",
  );

  const selected = catalog
    .filter((demo) => {
      if (ONLY_VALUES.length > 0) {
        const bySubject = ONLY_SUBJECTS.size > 0 && ONLY_SUBJECTS.has(demo.code);
        const byId = ONLY_IDS.has(demo.id);
        if (!bySubject && !byId) return false;
      }
      return true;
    })
    .slice(0, LIMIT > 0 ? LIMIT : undefined);
  if (selected.length === 0) {
    console.error("[demos] 没有匹配的演示（检查 --only/--ids）");
    process.exit(2);
  }

  const workDir = path.join(os.tmpdir(), "lwb-408card-demos-" + process.pid);
  await rm(workDir, { recursive: true, force: true });
  await buildHarness(workDir, { modules, dataIndexSource, css, vendors });
  log("harness:", workDir);

  const server = await serve(workDir);
  log("本地服务:", server.url);
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: FRAME_SCALE,
  });
  const consoleErrors = [];
  page.on("pageerror", (error) =>
    consoleErrors.push(String(error && error.message ? error.message : error)),
  );
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) consoleErrors.push("HTTP " + response.status() + " " + response.url());
  });
  await page.goto(server.url + "index.html", { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true");

  await mkdir(OUT_FRAMES, { recursive: true });
  const results = [];
  const failures = [];
  const measured = [];
  let totalFrames = 0;
  let totalBytes = 0;
  let resumeSkipped = 0;
  let framesOverTarget = 0;
  let largestFrame = { bytes: 0, frame: "" };

  /** --resume：复用上次 demos.json 的条目，只补缺失/帧不全的演示。 */
  const cachedById = new Map();
  try {
    const previous = JSON.parse(await readFile(OUT_JSON, "utf8"));
    for (const entry of previous.catalog || []) cachedById.set(entry.id, entry);
    if (cachedById.size > 0) log("载入上次 demos.json：可复用", cachedById.size, "个演示（--resume 时直接跳过）");
  } catch {
    if (RESUME) log("resume：没有可复用的 demos.json，全部重新抓取");
  }
  const framesComplete = async (entry) => {
    if (!entry || !Array.isArray(entry.steps) || entry.steps.length < MIN_STEPS) return false;
    let bytes = 0;
    for (const step of entry.steps) {
      const rel = String(step.frame || "").replace(/^content-demos\//, "");
      const abs = path.join(OUT_FRAMES, rel);
      try {
        const stat = await readFile(abs);
        bytes += stat.length;
      } catch {
        return false;
      }
    }
    entry.frameBytes = bytes;
    return true;
  };

  for (let demoIndex = 0; demoIndex < selected.length; demoIndex += 1) {
    const demo = selected[demoIndex];
    const label =
      "[" + (demoIndex + 1) + "/" + selected.length + "] " + demo.code + "/" + demo.id;
    try {
      if (RESUME && !FORCE) {
        const cached = cachedById.get(demo.id);
        if (cached && (await framesComplete(cached))) {
          results.push(cached);
          totalFrames += cached.frameCount || cached.steps.length;
          totalBytes += cached.frameBytes || 0;
          resumeSkipped += 1;
          log(label, "跳过（已有", (cached.frameCount || cached.steps.length), "帧）");
          continue;
        }
      }
      const mounted = await page.evaluate((id) => window.__mount(id), demo.id);
      if (!mounted || !mounted.ok) throw new Error((mounted && mounted.reason) || "mount failed");
      const explains = Array.isArray(mounted.steps) ? mounted.steps : [];
      if (MEASURE) {
        log(label, "steps=" + explains.length);
        measured.push({ id: demo.id, code: demo.code, steps: explains.length });
        continue;
      }
      const frameDir = path.join(OUT_FRAMES, demo.id);
      await rm(frameDir, { recursive: true, force: true });
      await mkdir(frameDir, { recursive: true });

      const steps = [];
      let bytesForDemo = 0;
      const stepIndexes = [];
      if (MAX_STEPS > 0 && explains.length > MAX_STEPS) {
        for (let k = 0; k < MAX_STEPS; k += 1) {
          const index = Math.round((k * (explains.length - 1)) / (MAX_STEPS - 1));
          if (stepIndexes[stepIndexes.length - 1] !== index) stepIndexes.push(index);
        }
      } else {
        for (let k = 0; k < explains.length; k += 1) stepIndexes.push(k);
      }
      for (const stepIndex of stepIndexes) {
        await page.evaluate((index) => window.__show(index), stepIndex);
        await sleep(15);
        const png = await page
          .locator("#capture-root")
          .screenshot({ type: "png", animations: "disabled" });
        const webp = await shrinkFrame(png, sharp);
        if (webp.length > TARGET_FRAME_BYTES) framesOverTarget += 1;
        if (webp.length > largestFrame.bytes) {
          largestFrame = { bytes: webp.length, frame: demo.id + "/" + (steps.length + 1) + ".webp" };
        }
        const fileName = String(steps.length + 1) + ".webp";
        await writeFile(path.join(frameDir, fileName), webp);
        bytesForDemo += webp.length;
        const explainText =
          stripHtml(explains[stepIndex]) ||
          stripHtml(await page.evaluate(() => window.__explain()));
        steps.push({ explain: explainText, frame: "content-demos/" + demo.id + "/" + fileName });
      }

      if (steps.length < MIN_STEPS) throw new Error("步骤数 " + steps.length + " < " + MIN_STEPS);
      if (!steps.every((step) => step.explain.length > 0)) {
        throw new Error("存在空 explain 的步骤");
      }
      const entry = {
        key: "408card/" + demo.id,
        sourceId: demo.id,
        sourceUrl: BASE + "#/vizp/" + demo.id + "?sub=" + demo.code,
        id: demo.id,
        code: demo.code,
        subjectKey: demo.subjectKey,
        title: demo.title,
        description: demo.description,
        sortOrder: demo.sortOrder,
        frameCount: steps.length,
        frameBytes: bytesForDemo,
        steps,
        fingerprint: "",
      };
      entry.fingerprint = fingerprintOf(entry);
      results.push(entry);
      totalFrames += steps.length;
      totalBytes += bytesForDemo;
      log(label, "→ " + steps.length + " 帧，" + Math.round(bytesForDemo / 1024) + "KB");
    } catch (error) {
      failures.push({
        id: demo.id,
        code: demo.code,
        error: String(error && error.message ? error.message : error),
      });
      log(label, "失败：" + (error && error.message ? error.message : error));
    }
  }

  if (largestFrame.bytes === 0 && results.length > 0) {
    for (const entry of results) {
      for (const step of entry.steps) {
        const rel = String(step.frame || "").replace(/^content-demos\//, "");
        const data = await readFile(path.join(OUT_FRAMES, rel));
        if (data.length > TARGET_FRAME_BYTES) framesOverTarget += 1;
        if (data.length > largestFrame.bytes) largestFrame = { bytes: data.length, frame: rel };
      }
    }
  }

  if (MEASURE) {
    const totalSteps = measured.reduce((sum, item) => sum + item.steps, 0);
    log("measure：", measured.length, "个演示，共", totalSteps, "步，平均", (totalSteps / measured.length).toFixed(1));
    const big = measured.filter((item) => item.steps > 60).sort((a, b) => b.steps - a.steps);
    if (big.length) log("超过 60 步的演示：", big.map((item) => item.id + ":" + item.steps).join(", "));
    await browser.close();
    await server.close();
    await rm(workDir, { recursive: true, force: true });
    return;
  }

  const capturedById = new Map(results.map((entry) => [entry.id, entry]));
  const finalCatalog = [];
  for (const demo of catalog) {
    const entry = capturedById.get(demo.id) || cachedById.get(demo.id);
    if (entry) finalCatalog.push(entry);
  }
  const reused = finalCatalog.length - results.length;
  if (reused > 0) log("合并上次结果：" + reused + " 个演示沿用 demos.json（本次未抓取）");

  const payload = {
    source: "408card-top",
    baseUrl: BASE,
    capturedAt: new Date().toISOString(),
    frameRoot: "apps/web/public/content-demos",
    framePathPrefix: "content-demos",
    chrome: CHROME,
    minSteps: MIN_STEPS,
    maxFrameBytes: MAX_FRAME_BYTES,
    stats: {
      demos: finalCatalog.length,
      frames: finalCatalog.reduce((sum, demo) => sum + (demo.frameCount || demo.steps.length), 0),
      bytes: finalCatalog.reduce((sum, demo) => sum + (demo.frameBytes || 0), 0),
      resumeSkipped,
      framesOverTarget,
      largestFrame,
      bySubject: finalCatalog.reduce((acc, demo) => {
        const item = acc[demo.code] || { demos: 0, frames: 0, bytes: 0 };
        item.demos += 1;
        item.frames += demo.frameCount || demo.steps.length;
        item.bytes += demo.frameBytes || 0;
        acc[demo.code] = item;
        return acc;
      }, {}),
      failures: failures.length,
    },
    catalog: finalCatalog,
    failures,
  };
  await writeFile(OUT_JSON, JSON.stringify(payload, null, 1) + "\n", "utf8");
  const finalFrames = payload.stats.frames;
  const finalBytes = payload.stats.bytes;
  log(
    "写出",
    OUT_JSON,
    "（" + finalCatalog.length + " demo / " + finalFrames + " 帧 / " + (finalBytes / 1024 / 1024).toFixed(2) + "MB）",
  );
  const subjectRows = Object.entries(payload.stats.bySubject)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .map(
      ([code, item]) =>
        code + " " + item.demos + " 个 / " + item.frames + " 帧 / " + (item.bytes / 1024 / 1024).toFixed(2) + "MB",
    );
  log("按科目：", subjectRows.join("；"));
  const top = finalCatalog
    .slice()
    .sort((a, b) => (b.frameBytes || 0) - (a.frameBytes || 0))
    .slice(0, 5)
    .map((demo) => demo.id + " " + (demo.frameCount || demo.steps.length) + " 帧 " + Math.round((demo.frameBytes || 0) / 1024) + "KB");
  log("最大的 5 个演示：", top.join("；"));
  log(
    "总大小：",
    (finalBytes / 1024 / 1024).toFixed(2) + "MB",
    "平均单帧",
    Math.round(finalBytes / Math.max(1, finalFrames) / 1024) + "KB",
    framesOverTarget > 0 ? "（" + framesOverTarget + " 帧超过 15KB 目标）" : "（全部 ≤15KB）",
    "最大单帧",
    Math.round(largestFrame.bytes / 1024) + "KB @" + largestFrame.frame,
  );

  await browser.close();
  await server.close();
  if (!KEEP) await rm(workDir, { recursive: true, force: true });
  else log("harness 保留在", workDir);

  if (consoleErrors.length > 0) {
    log("页面错误（" + consoleErrors.length + " 条，去重后前 5 条）：");
    consoleErrors.slice(0, 5).forEach((message) => log("  - " + message.slice(0, 200)));
  }
  if (failures.length > 0) {
    console.error("[demos] " + failures.length + " 个演示抓取失败（已保留上次成功结果，如无则为缺）：");
    failures.forEach((failure) => console.error("  - " + failure.id + ": " + failure.error));
    process.exit(1);
  }
  log("完成：本次抓取 " + results.length + " 个，catalog 共 " + finalCatalog.length + " 个演示");
}

main().catch((error) => {
  console.error("[demos] 失败：" + (error && error.stack ? error.stack : error));
  process.exit(1);
});
