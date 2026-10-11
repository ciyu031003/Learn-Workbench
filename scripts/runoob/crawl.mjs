#!/usr/bin/env node
/**
 * runoob.com（菜鸟教程）抓取。
 *
 * 抓什么（只抓「有官方测验」的 19 个教程，见 lib/runoob.mjs 的 RUNOOB_STAGES）：
 *   1) 测验页 `/quiz/<slug>-quiz.html` → 内嵌 quizData（题干/选项/正确下标/解析）；
 *   2) 教程首页 + 左侧栏里的**同目录**子页 → 正文小节（标题/段落/代码）。
 *
 * 不抓：`/try/`（robots.txt 明确 Disallow）、数学/英语等无关栏目、外站（jyshare）。
 *
 * 礼貌口径：单请求超时 + 指数退避重试 + 并发上限 + 请求间隔；原文按 URL 哈希落缓存（可续跑）；
 * 失败清单落盘，下次优先重爬；统计写进 `summary.json`。
 *
 * 用法：
 *   node scripts/runoob/crawl.mjs               # 全量（命中缓存则零请求）
 *   node scripts/runoob/crawl.mjs --only=quiz
 *   node scripts/runoob/crawl.mjs --only=pages
 *   node scripts/runoob/crawl.mjs --limit=2     # 只抓前 2 个阶段（调试）
 *   node scripts/runoob/crawl.mjs --no-cache
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_FETCH_POLICY,
  backoffDelay,
  crawlStats,
  recordFailure,
  restoreFailures,
  serializeFailures,
} from "../lib/crawl-core.mjs";
import {
  RUNOOB_ORIGIN,
  RUNOOB_STAGES,
  extractQuizData,
  parseTutorialPage,
  tutorialPages,
} from "../lib/runoob.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq > 2) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = path.resolve(ROOT, String(args.out ?? ".local/runoob"));
const HTML_DIR = path.join(OUT_DIR, "html");
const USE_CACHE = !args["no-cache"];
const ONLY = String(args.only ?? "");
const LIMIT = Number(args.limit) > 0 ? Math.floor(Number(args.limit)) : 0;
const POLICY = {
  ...DEFAULT_FETCH_POLICY,
  concurrency: Math.max(1, Number(args.concurrency ?? 3)),
  gapMs: Math.max(0, Number(args.gap ?? 260)),
};

const UA = {
  "user-agent": "learn-workbench-content-crawler/1.0 (personal study use; +https://learn.yuanabd.cn)",
  "accept-language": "zh-CN,zh;q=0.9",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { requests: 0, retried: 0, filesOk: 0, filesFailed: 0 };
const failures = new Map();

const cachePathFor = (url) => path.join(HTML_DIR, createHash("sha1").update(url).digest("hex") + ".html");

async function fetchText(url) {
  let lastError = null;
  const tries = 1 + POLICY.retries;
  for (let attempt = 1; attempt <= tries; attempt++) {
    stats.requests++;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), POLICY.timeoutMs);
    try {
      const res = await fetch(url, { headers: UA, signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (error) {
      const aborted = error?.name === "AbortError" || error?.cause?.name === "AbortError";
      lastError = aborted ? new Error(`超时 ${POLICY.timeoutMs}ms ${url}`) : error;
      if (attempt < tries) {
        stats.retried++;
        await sleep(backoffDelay(attempt, POLICY.backoffMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error(`抓取失败 ${url}`);
}

async function readHtml(url) {
  const file = cachePathFor(url);
  if (USE_CACHE) {
    try {
      return await readFile(file, "utf8");
    } catch {
      /* 未命中 */
    }
  }
  const html = await fetchText(url);
  await mkdir(HTML_DIR, { recursive: true });
  await writeFile(file, html, "utf8");
  await sleep(POLICY.gapMs);
  return html;
}

async function runPool(items, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(POLICY.concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      try {
        const value = await worker(item);
        if (value !== undefined) results.push(value);
        stats.filesOk++;
      } catch (error) {
        stats.filesFailed++;
        recordFailure(failures, item.url ?? String(item), error);
        console.warn(`[runoob] 失败 ${item.url ?? item}：${error?.message ?? error}`);
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  try {
    for (const [url, error] of restoreFailures(JSON.parse(await readFile(path.join(OUT_DIR, "failures.json"), "utf8")))) {
      failures.set(url, error);
    }
  } catch {
    /* 首次运行 */
  }

  const stages = LIMIT ? RUNOOB_STAGES.slice(0, LIMIT) : RUNOOB_STAGES;
  const quizSlugs = [...new Set(stages.flatMap((s) => s.quizzes))];

  // ---- 1) 测验页 ----
  const quizRows = ONLY === "pages" ? [] : await runPool(
    quizSlugs.map((slug) => ({ url: `${RUNOOB_ORIGIN}/quiz/${slug}-quiz.html`, slug })),
    async (item) => {
      const html = await readHtml(item.url);
      const data = extractQuizData(html);
      if (!data || data.questions.length === 0) throw new Error(`未解析到 quizData（${item.slug}）`);
      return { slug: item.slug, url: item.url, title: data.title, questions: data.questions };
    }
  );

  // ---- 2) 教程首页 → 同目录子页 ----
  let pageRows = [];
  if (ONLY !== "quiz") {
    for (const stage of stages) {
      const landingUrl = RUNOOB_ORIGIN + stage.tutorial;
      const landing = await readHtml(landingUrl);
      const subPages = tutorialPages(landing, stage.tutorial);
      const targets = [{ url: landingUrl, path: stage.tutorial }];
      for (const page of subPages) {
        if (page.path === stage.tutorial) continue;
        targets.push({ url: RUNOOB_ORIGIN + page.path, path: page.path });
      }
      console.log(`[runoob] ${stage.id}：${targets.length} 页`);
      const parsed = await runPool(targets, async (item) => {
        const html = await readHtml(item.url);
        const page = parseTutorialPage(html);
        return { stage: stage.id, track: stage.track, path: item.path, url: item.url, ...page };
      });
      pageRows.push(...parsed);
    }
  }

  const writeJsonl = async (name, rows) =>
    writeFile(
      path.join(OUT_DIR, name),
      rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""),
      "utf8"
    );
  await writeJsonl("quizzes.jsonl", quizRows);
  await writeJsonl("pages.jsonl", pageRows);

  const questionTotal = quizRows.reduce((n, row) => n + row.questions.length, 0);
  const summary = {
    generatedAt: new Date().toISOString(),
    quizzes: quizRows.length,
    questions: questionTotal,
    pages: pageRows.length,
    sections: pageRows.reduce((n, row) => n + row.sections.length, 0),
    codes: pageRows.reduce((n, row) => n + row.sections.reduce((m, s) => m + s.codes.length, 0), 0),
    byQuiz: Object.fromEntries(quizRows.map((row) => [row.slug, row.questions.length])),
    byStage: Object.fromEntries(
      stages.map((s) => [s.id, pageRows.filter((row) => row.stage === s.id).length])
    ),
    stats: crawlStats(stats),
  };
  await writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await writeFile(
    path.join(OUT_DIR, "failures.json"),
    JSON.stringify(serializeFailures(failures), null, 1),
    "utf8"
  );

  console.log(`[runoob] 测验 ${quizRows.length} 页 / 题目 ${questionTotal} 道`);
  console.log(`[runoob] 教程页 ${pageRows.length} 页 / 小节 ${summary.sections} 个 / 代码块 ${summary.codes} 段`);
  console.log(`[runoob] 抓取统计 ${JSON.stringify(summary.stats)}；失败 ${failures.size} 条`);
  if (failures.size) console.log(`[runoob] 失败明细：${path.relative(ROOT, path.join(OUT_DIR, "failures.json"))}`);
}

await main().catch((error) => {
  console.error("[runoob] 抓取失败：" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
