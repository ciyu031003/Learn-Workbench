#!/usr/bin/env node
/**
 * csgraduates 408 抓取（站点：https://www.csgraduates.com/ ，Hugo 静态站）。
 *
 * 只抓 408：
 *   - 题库：`/study_methods/408quiz/<2009..2026>/` → 选择题（题干/选项/答案/解析/考点标签）
 *           与解答题（题干/参考解答/参考代码）；
 *   - 知识点：`/data_structure|constitution_principle|operating_system|computer_network>/<章>/[<页>/]`。
 * 数学 / 英语 / 政治 / 经验贴一律不抓（用户口径：「只抓取 408 的题目和答案就可以了」）。
 *
 * 特性（与 `crawl_interview.mjs` 同口径）：
 *   超时 + 指数退避重试 + 并发上限 + 请求间隔；原文按 URL 哈希落缓存（可续跑）；
 *   失败清单落盘，下次优先重爬；统计写进 `summary.json`。
 *
 * 用法：
 *   node scripts/cs-graduates/crawl.mjs                 # 抓全部（命中缓存则零请求）
 *   node scripts/cs-graduates/crawl.mjs --only=quiz     # 只抓真题页
 *   node scripts/cs-graduates/crawl.mjs --no-cache      # 忽略缓存重抓
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
  parseKnowledgePage,
  parseQuizPage,
  parseSitemapUrls,
  planTargets,
} from "../lib/csgraduates.mjs";

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
const OUT_DIR = path.resolve(ROOT, String(args.out ?? ".local/csgrad"));
const HTML_DIR = path.join(OUT_DIR, "html");
const ORIGIN = String(args.origin ?? "http://www.csgraduates.com").replace(/\/+$/, "");
const USE_CACHE = !args["no-cache"];
const ONLY = String(args.only ?? "");
const LIMIT = Number(args.limit) > 0 ? Math.floor(Number(args.limit)) : 0;
const POLICY = {
  ...DEFAULT_FETCH_POLICY,
  concurrency: Math.max(1, Number(args.concurrency ?? 3)),
  gapMs: Math.max(0, Number(args.gap ?? 220)),
};

const UA = {
  "user-agent": "learn-workbench-content-crawler/1.0 (personal study use; +https://learn.yuanabd.cn)",
  "accept-language": "zh-CN,zh;q=0.9",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { requests: 0, retried: 0, filesOk: 0, filesFailed: 0 };
const failures = new Map();

function cachePathFor(url) {
  return path.join(HTML_DIR, createHash("sha1").update(url).digest("hex") + ".html");
}

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

/** 读原文：默认先用缓存（可续跑），未命中再走网络并回写 */
async function readHtml(url) {
  const file = cachePathFor(url);
  if (USE_CACHE) {
    try {
      return { html: await readFile(file, "utf8"), cached: true };
    } catch {
      /* 未命中 */
    }
  }
  const html = await fetchText(url);
  await mkdir(HTML_DIR, { recursive: true });
  await writeFile(file, html, "utf8");
  await sleep(POLICY.gapMs);
  return { html, cached: false };
}

/** 固定并发的工作池（结果与失败都记账） */
async function runPool(items, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(POLICY.concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      try {
        results.push(await worker(item));
        stats.filesOk++;
      } catch (error) {
        stats.filesFailed++;
        recordFailure(failures, item.url, error);
        console.warn(`[csgraduates] 失败 ${item.url}：${error?.message ?? error}`);
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function loadFailures() {
  try {
    return restoreFailures(JSON.parse(await readFile(path.join(OUT_DIR, "failures.json"), "utf8")));
  } catch {
    return new Map();
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const [url, error] of await loadFailures()) failures.set(url, error);

  const sitemapPath = path.join(OUT_DIR, "sitemap.xml");
  let sitemapXml;
  try {
    sitemapXml = USE_CACHE ? await readFile(sitemapPath, "utf8") : "";
  } catch {
    sitemapXml = "";
  }
  if (!sitemapXml) {
    sitemapXml = await fetchText(`${ORIGIN}/sitemap.xml`);
    await writeFile(sitemapPath, sitemapXml, "utf8");
  }
  const plan = planTargets(parseSitemapUrls(sitemapXml), ORIGIN);
  console.log(
    `[csgraduates] 目标：真题 ${plan.quiz.length} 页 · 知识点 ${plan.knowledge.length} 页 · 章节 ${plan.chapters.length} 页`
  );

  const quizTargets = ONLY === "knowledge" ? [] : LIMIT ? plan.quiz.slice(0, LIMIT) : plan.quiz;
  const knowledgeTargets =
    ONLY === "quiz" ? [] : LIMIT ? plan.knowledge.slice(0, LIMIT) : [...plan.knowledge, ...plan.chapters];

  const quizPages = await runPool(quizTargets, async (item) => {
    const { html } = await readHtml(item.url);
    return parseQuizPage(html, item.url);
  });
  const knowledgePages = await runPool(knowledgeTargets, async (item) => {
    const { html } = await readHtml(item.url);
    return parseKnowledgePage(html, item.url);
  });

  const questions = quizPages.flatMap((page) => page.questions.map((q) => ({ ...q, year: page.year })));
  const solutions = quizPages.flatMap((page) => page.solutions.map((s) => ({ ...s, year: page.year })));

  const answerMismatch = quizPages.flatMap((page) =>
    page.questions
      .map((q) => ({ q, row: page.answerTable.find((r) => r.no === q.number) }))
      .filter(({ q, row }) => row && row.answer !== q.answer)
      .map(({ q, row }) => ({ year: page.year, no: q.number, dataAnswer: q.answer, tableAnswer: row.answer }))
  );

  const write = async (name, rows) => {
    await writeFile(path.join(OUT_DIR, name), rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""), "utf8");
  };
  await write("questions.jsonl", questions);
  await write("solutions.jsonl", solutions);
  await write("knowledge.jsonl", knowledgePages);
  await writeFile(path.join(OUT_DIR, "failures.json"), JSON.stringify(serializeFailures(failures), null, 1), "utf8");

  const bySubject = questions.reduce((acc, q) => ((acc[q.subject ?? "?"] = (acc[q.subject ?? "?"] ?? 0) + 1), acc), {});
  const summary = {
    origin: ORIGIN,
    crawledAt: new Date().toISOString(),
    stats: crawlStats(stats),
    quizPages: quizPages.length,
    knowledgePages: knowledgePages.length,
    questions: questions.length,
    solutions: solutions.length,
    questionsBySubject: bySubject,
    questionsWithExplanation: questions.filter((q) => q.explanation).length,
    questionsWithKnowledgeLink: questions.filter((q) => q.knowledgePaths.length > 0).length,
    answerTableMismatch: answerMismatch,
    knowledgeWithPriority: knowledgePages.filter((k) => k.priority).length,
    failures: serializeFailures(failures),
  };
  await writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 1), "utf8");
  console.log(`[csgraduates] ${JSON.stringify({ ...summary, failures: summary.failures.length })}`);
  if (answerMismatch.length > 0) console.warn(`[csgraduates] 答案与速对表不一致 ${answerMismatch.length} 处`);
  if (failures.size > 0) process.exitCode = 1;
}

await main().catch((error) => {
  console.error(`[csgraduates] 失败：${error?.stack ?? error}`);
  process.exitCode = 1;
});
