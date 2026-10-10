/**
 * 面试题库抓取（v12 P2-1；v1.26 接入每日定时）
 *
 * 用法：
 *   node scripts/crawl_interview.mjs                        # 只抓取 + 落本地 JSON
 *   node scripts/crawl_interview.mjs --import --run-id 12    # 抓完直接导入线上（cron 走这条）
 *   node scripts/crawl_interview.mjs --dry-run               # 只解析、不导入（链路自检）
 *   node scripts/crawl_interview.mjs --from-file a.md --import --dry-run
 *                                                            # 离线解析本地 markdown → 证明解析/判重/分块链路
 *   node scripts/crawl_interview.mjs --limit 50 --files 5     # 小样本
 *   node scripts/crawl_interview.mjs --concurrency 6 --timeout 30000
 *                                                            # 调并发/超时（默认 4 并发、20s 超时、失败重试 2 次）
 *   node scripts/crawl_interview.mjs --no-cache               # 忽略本地缓存、整轮重新下载
 *
 * 合规约定（用户已确认「抓公开内容、保留来源」）：
 *  - 只抓公开仓库的 markdown（经 jsDelivr CDN 读取，不绕任何反爬）；
 *  - 每条都带 sourceUrl / sourceSite / license，入库后可一键下架（is_listed）；
 *  - 只存「问题 + 答案文本」，不搬运图片等资源；
 *  - 抓取限速，且只取每个文件里结构清晰的问答标题。
 *
 * 韧性口径（组一 · 阶段 6 加固）：
 *  - 每个请求带 20s 超时（AbortController），失败按 400/800ms 指数退避重试 2 次 → 单文件抖动不再丢一批题；
 *  - 并发 4（可 --concurrency 调），每个请求之间仍 sleep 160ms，整体限速不放松；
 *  - 抓成功的原文落 .local/interview-out/raw/ 缓存，重跑默认走缓存 → **可续跑**、也少打扰 CDN；
 *  - 抓失败的文件写 .local/interview-out/failures.json，下一轮**优先重爬**这些文件；
 *  - 抓取统计（请求数/重试数/成功失败文件数）落 crawl-stats.json 并打印。
 *
 * 去重口径（v1.26 起**由服务端负责**，见 apps/web/lib/interview/import-core.ts）：
 *  归一化 = 全角空格→半角 + 转小写 + 去掉所有空白；external_key = <sourceSite>#<sha1(归一化题目前 16 位)>。
 *  脚本侧只保留同一份归一化规则用于"同一次 payload 内去重"（下方 normalizeQuestion 是它的镜像），
 *  **不再自己算 externalKey** —— 历史 611 条是按原始文本算键的，若客户端各算各的，
 *  重爬会插出第二份；服务端按题目归一化判重才能真正保证「题目不重复」。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  DEFAULT_FETCH_POLICY,
  backoffDelay,
  crawlStats,
  normalizeFileList,
  recordFailure,
  restoreFailures,
  serializeFailures,
  splitIntoBatches,
} from "./lib/crawl-core.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key.slice(2)] = next; i++; }
    else out[key.slice(2)] = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = path.resolve(args.out ?? ".local/interview-out");
const TOTAL_LIMIT = Number(args.limit ?? 1500);
const FILE_LIMIT = Number(args.files ?? 300);
/** 单次 POST 的条目数（服务端还会再按 1000 自动分块，这里只是控制请求体大小与超时） */
const BATCH_SIZE = Math.max(1, Number(args.batch ?? 300));
const RUN_ID = Number(args["run-id"]) || 0;
const DO_IMPORT = Boolean(args.import) && !args["dry-run"];
const FROM_FILE = typeof args["from-file"] === "string" ? args["from-file"] : "";
const API_BASE = String(args.api ?? process.env.LWB_API_URL ?? "http://127.0.0.1:" + (process.env.APP_PORT ?? "3001")).replace(/\/+$/, "");
const CRON_SECRET = (process.env.CRON_SECRET ?? "").trim();
const UA = { "user-agent": "Mozilla/5.0 (compatible; LWB-InterviewCrawler/1.0)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 抓取策略（阶段 6：超时 / 重试 / 限速 / 并发） */
const POLICY = {
  timeoutMs: Math.max(1000, Number(args.timeout ?? DEFAULT_FETCH_POLICY.timeoutMs)),
  retries: Math.max(0, Number(args.retries ?? DEFAULT_FETCH_POLICY.retries)),
  backoffMs: DEFAULT_FETCH_POLICY.backoffMs,
  gapMs: DEFAULT_FETCH_POLICY.gapMs,
  concurrency: Math.min(8, Math.max(1, Number(args.concurrency ?? DEFAULT_FETCH_POLICY.concurrency))),
};
/** 原文缓存（可续跑）；--no-cache 时整轮重新下载 */
const USE_CACHE = !args["no-cache"];
const RAW_DIR = path.join(OUT_DIR, "raw");
const FAILURES_FILE = path.join(OUT_DIR, "failures.json");
const STATS_FILE = path.join(OUT_DIR, "crawl-stats.json");

/** 目录名 → 中文模块名（让题库的模块筛选更可读） */
const SUB_NAME = {
  basis: "基础",
  concurrent: "并发",
  collection: "集合",
  jvm: "JVM",
  io: "IO",
  "new-features": "新特性",
  network: "网络",
  mysql: "MySQL",
  redis: "Redis",
  mongodb: "MongoDB",
  nosql: "NoSQL",
  protocol: "协议",
  rpc: "RPC",
  "spring-cloud-gateway-questions": "网关",
  "internship-experience": "实习经历",
  "key-points-of-interview": "面试要点",
  "project-experience-guide": "项目经历",
  "high-concurrency": "高并发",
  "distributed-transaction": "分布式事务",
  "system-design": "系统设计",
};

/** 来源仓库（只放公开、可署名、许可证明确的） */
const SOURCES = [
  {
    repo: "Snailclimb/JavaGuide",
    ref: "main",
    license: "Apache-2.0",
    sourceSite: "github:Snailclimb/JavaGuide",
    site: "https://github.com/Snailclimb/JavaGuide",
    include: /^docs\/(java|database|cs-basics|distributed-system|system-design|open-source-project|interview-preparation|high-performance|high-availability|high-quality-technical-articles)\//,
    moduleOf: (file) => {
      const seg = file.replace(/^docs\//, "").split("/");
      const area = seg[0] ?? "其他";
      const sub = seg[1] ?? "";
      const map = {
        java: "Java", database: "数据库", "cs-basics": "计算机基础",
        "distributed-system": "分布式与高并发", "system-design": "系统设计",
        "interview-preparation": "面试准备", "open-source-project": "项目经验",
        "high-performance": "高性能", "high-availability": "高可用",
        "high-quality-technical-articles": "技术文章",
      };
      const areaName = map[area] ?? area;
      const subName = SUB_NAME[sub.replace(/\.md$/, "")] ?? sub.replace(/\.md$/, "");
      return subName && subName.length <= 12 ? areaName + " · " + subName : areaName;
    },
  },
];

/**
 * 带超时 + 指数退避重试的 GET。每次尝试都计入 stats.requests，重试计入 stats.retried。
 * 超时用 AbortController 实现（fetch 原生没有 timeout 参数）。
 */
async function fetchText(url, options = {}) {
  const stats = options.stats;
  const tries = 1 + Math.max(0, Number(options.retries ?? POLICY.retries));
  let lastError = null;
  for (let attempt = 1; attempt <= tries; attempt++) {
    if (stats) stats.requests++;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), POLICY.timeoutMs);
    try {
      const res = await fetch(url, { headers: UA, signal: ac.signal });
      if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
      return await res.text();
    } catch (e) {
      // undici 会把 abort 包成 TypeError("fetch failed"，cause=AbortError)，两种都要认得
      const aborted = e?.name === "AbortError" || e?.cause?.name === "AbortError";
      lastError = aborted ? new Error("超时 " + POLICY.timeoutMs + "ms " + url) : e;
      if (attempt < tries) {
        if (stats) stats.retried++;
        await sleep(backoffDelay(attempt, POLICY.backoffMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("抓取失败 " + url);
}

function rawCachePath(url) {
  return path.join(RAW_DIR, createHash("sha1").update(url).digest("hex") + ".md");
}

/** 读原文：默认先看本地缓存（可续跑），未命中再抓网络并回写缓存。 */
async function readDoc(url, stats) {
  if (USE_CACHE) {
    try {
      return { text: await readFile(rawCachePath(url), "utf8"), cached: true };
    } catch {
      /* 缓存未命中，走网络 */
    }
  }
  const text = await fetchText(url, { stats });
  if (USE_CACHE) {
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(rawCachePath(url), text, "utf8");
  }
  return { text, cached: false };
}

/** 上一轮的失败清单（URL → 错误），本轮用来优先重爬。 */
async function loadFailures() {
  try {
    return restoreFailures(JSON.parse(await readFile(FAILURES_FILE, "utf8")));
  } catch {
    return new Map();
  }
}

async function saveFailures(failures) {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    FAILURES_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), failures: serializeFailures(failures) }, null, 2) + "\n",
    "utf8"
  );
}

/** jsDelivr 文件清单（flat 结构），便于只挑 markdown */
async function listFiles(source, stats) {
  const url = "https://data.jsdelivr.com/v1/packages/gh/" + source.repo + "@" + source.ref + "?structure=flat";
  const data = JSON.parse(await fetchText(url, { stats, retries: 1 }));
  const files = (data?.files ?? []).map((f) => String(f.name ?? "").replace(/^\//, ""));
  return files.filter((f) => f.endsWith(".md") && source.include.test(f));
}

function rawUrl(source, file) {
  return "https://cdn.jsdelivr.net/gh/" + source.repo + "@" + source.ref + "/" + file;
}

function blobUrl(source, file) {
  return "https://github.com/" + source.repo + "/blob/" + source.ref + "/" + file;
}

/** 去掉 markdown 噪声（图片、锚点、过多空行），保留可读文本 */
function cleanText(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 由标题 + 答案猜难度（保守：默认 medium） */
function guessDifficulty(question, answer) {
  const q = question;
  if (/(手写|实现一个|设计一个|如何设计|源码|原理|底层|调优|优化)/.test(q) || answer.length > 1500) return "hard";
  if (/(是什么|什么是|有哪些|区别|简介|简单|概念)/.test(q) && answer.length < 400) return "easy";
  return "medium";
}

/**
 * 题目归一化（**apps/web/lib/interview/import-core.ts 的镜像**，仅用于同一次 payload 内去重；
 * 权威判定在服务端）。规则：全角空格→半角 + 转小写 + 去掉所有空白。
 */
function normalizeQuestion(question) {
  return String(question ?? "").replace(/\u3000/g, " ").toLowerCase().replace(/\s+/g, "");
}

/**
 * 解析 markdown：以「以 ? / ？ 结尾的 ###/#### 标题」为问题，
 * 到下一个同级或更高级标题之间的正文为参考答案。
 * 注意：**不再输出 externalKey** —— 由服务端用归一化题目现算（见文件头说明）。
 */
function parseQA(markdown, meta) {
  const lines = markdown.split(/\r?\n/);
  const items = [];
  let current = null;
  let buffer = [];

  const flush = () => {
    if (current) {
      const answer = cleanText(buffer.join("\n"));
      // 过滤：答案太短（没内容）、或纯目录/链接堆
      if (answer.length >= 60 && answer.length <= 8000) {
        items.push({ ...current, answer });
      }
    }
    current = null;
    buffer = [];
  };

  for (const line of lines) {
    const m = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const title = cleanText(m[2]).replace(/^[\d一二三四五六七八九十]+[.、)．]\s*/, "").trim();
      const isQuestion = /[?？]$/.test(title) && title.length >= 8 && title.length <= 120;
      if (isQuestion) {
        flush();
        current = { question: title };
      } else {
        flush();
      }
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();

  return items.map((it) => ({
    module: meta.module,
    question: it.question,
    answer: it.answer,
    difficulty: guessDifficulty(it.question, it.answer),
    tags: meta.tags,
    sourceUrl: meta.sourceUrl,
    sourceSite: meta.sourceSite,
    license: meta.license,
    crawledAt: new Date().toISOString(),
  }));
}

/** 同一份 payload 内去重（跨运行/跨来源的判重在服务端） */
function dedupe(items, seen) {
  const out = [];
  for (const item of items) {
    const key = normalizeQuestion(item.question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * 调内部导入接口；返回服务端统计。
 * 最后一批（或空批次）带上 run 回报，把 interview_crawl_runs 写成终态。
 */
async function postImport(items, run) {
  if (!CRON_SECRET) throw new Error("缺少 CRON_SECRET（导入接口鉴权需要）");
  const url = API_BASE + "/api/internal/interview/import";
  let imported = 0;
  let skipped = 0;
  let duplicateInPayload = 0;
  const batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));

  for (let i = 0; i < batches.length; i++) {
    const body = { items: batches[i] };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error("导入失败 HTTP " + res.status + " " + (data?.error ?? ""));
    imported += Number(data?.imported ?? 0);
    skipped += Number(data?.skipped?.length ?? 0);
    duplicateInPayload += Number(data?.duplicateInPayload ?? 0);
    console.log("[interview] 批次 " + (i + 1) + "/" + batches.length + " → 入库 " + Number(data?.imported ?? 0));
  }

  // 分批响应只能看到当前批次的 imported；全部完成后用空 payload 回写整轮汇总，
  // 避免 interview_crawl_runs.imported_count 被最后一批覆盖。
  if (run) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify({ items: [], run: { ...run, imported, skipped } }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error("运行记录回写失败 HTTP " + res.status + " " + (data?.error ?? ""));
  }

  return { imported, skipped, duplicateInPayload };
}

/**
 * 抓取（默认网络；--from-file 时只读本地文件，用于离线自检）。
 * 网络分支：并发下载（默认 4）+ 每请求超时/重试 + 原文缓存续跑 + 失败清单优先重爬。
 * `stats` 会就地累加请求数/重试数/成功失败文件数，供调用方落盘与回填运行记录。
 */
async function collect(stats) {
  const all = [];
  const seen = new Set();
  const failures = new Map();

  if (FROM_FILE) {
    const source = SOURCES[0];
    const md = await readFile(path.resolve(FROM_FILE), "utf8");
    const rel = path.basename(FROM_FILE);
    const items = parseQA(md, {
      module: "离线样本",
      tags: ["fixture"],
      sourceUrl: "file://" + rel,
      sourceSite: source.sourceSite,
      license: source.license,
    });
    const fresh = dedupe(items, seen);
    all.push(...fresh.slice(0, TOTAL_LIMIT));
    console.log("[interview] --from-file 解析出 " + items.length + " 条，去重后 " + all.length + " 条");
    return { all, failures };
  }

  const previousFailures = await loadFailures();
  if (previousFailures.size > 0) {
    console.log("[interview] 上次失败清单 " + previousFailures.size + " 个文件（本轮优先重爬）");
  }

  for (const source of SOURCES) {
    let files = [];
    try {
      files = await listFiles(source, stats);
    } catch (e) {
      console.warn("[interview] 文件清单失败：" + source.repo + " " + e.message);
      continue;
    }
    let targets = normalizeFileList(files).slice(0, FILE_LIMIT);
    // 上轮抓失败的排到最前：先补上缺的，再按文件名顺序拿新的
    if (previousFailures.size > 0) {
      const retryFirst = targets.filter((f) => previousFailures.has(rawUrl(source, f)));
      if (retryFirst.length > 0) {
        const retrySet = new Set(retryFirst);
        targets = [...retryFirst, ...targets.filter((f) => !retrySet.has(f))];
        console.log("[interview] " + source.repo + " 本轮优先重爬 " + retryFirst.length + " 个历史失败文件");
      }
    }
    console.log("[interview] " + source.repo + " 命中 " + files.length + " 个 markdown（取前 " + FILE_LIMIT + "）");

    const batches = splitIntoBatches(targets, POLICY.concurrency);
    for (const batch of batches) {
      if (all.length >= TOTAL_LIMIT) break;
      // 并发下载这一批；单文件失败只记进 failures，不影响整批
      const docs = await Promise.all(
        batch.map(async (file) => {
          const url = rawUrl(source, file);
          try {
            const { text, cached } = await readDoc(url, stats);
            if (!cached && POLICY.gapMs > 0) await sleep(POLICY.gapMs); // 限速只对真实网络请求生效
            return { file, text };
          } catch (e) {
            recordFailure(failures, url, e);
            console.warn("  ! 跳过 " + file + "（" + String(e?.message ?? e).slice(0, 80) + "）");
            return null;
          }
        })
      );

      // 排序后再解析，保证并发下产物顺序仍然是确定的
      const ok = docs.filter(Boolean).sort((a, b) => a.file.localeCompare(b.file));
      stats.filesOk += ok.length;
      stats.filesFailed += docs.length - ok.length;
      for (const { file, text } of ok) {
        const module = source.moduleOf(file);
        const tags = file.replace(/^docs\//, "").split("/").slice(0, 3).map((s) => s.replace(/\.md$/, ""));
        const items = parseQA(text, { module, tags, sourceUrl: blobUrl(source, file), sourceSite: source.sourceSite, license: source.license });
        const fresh = dedupe(items, seen);
        let added = 0;
        for (const item of fresh) {
          if (all.length >= TOTAL_LIMIT) break;
          all.push(item);
          added++;
        }
        if (added > 0) console.log("  +" + String(added).padStart(3) + " " + module + "  ← " + file);
      }
    }
  }

  await saveFailures(failures);
  if (failures.size > 0) console.warn("[interview] 本轮失败 " + failures.size + " 个文件 → " + FAILURES_FILE);
  return { all, failures };
}

async function writeLocal(all, stats) {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(all, null, 2) + "\n", "utf8");

  // 同时导出「按模块分块」的 JSON（给 COS 桶 interview/ 用）
  const byModule = new Map();
  for (const it of all) {
    const key = it.module.replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "misc";
    if (!byModule.has(key)) byModule.set(key, []);
    byModule.get(key).push(it);
  }
  const chunksDir = path.join(OUT_DIR, "chunks");
  await mkdir(chunksDir, { recursive: true });
  for (const [key, list] of byModule) {
    await writeFile(path.join(chunksDir, key + ".json"), JSON.stringify(list, null, 2) + "\n", "utf8");
  }

  const counts = {};
  for (const it of all) counts[it.module] = (counts[it.module] ?? 0) + 1;
  console.log("[interview] 完成：" + all.length + " 条 → " + OUT_DIR);
  console.log("[interview] 模块分布：" + JSON.stringify(counts));
  console.log("[interview] 分块：" + byModule.size + " 个（chunks/）");

  const summary = crawlStats(stats);
  await writeFile(
    STATS_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), items: all.length, ...summary }, null, 2) + "\n",
    "utf8"
  );
  console.log(
    "[interview] 抓取统计：文件成功 " + summary.filesOk + " / 失败 " + summary.filesFailed +
      "（共 " + summary.filesTotal + "），请求 " + summary.requests + " 次，其中重试 " + summary.retried + " 次"
  );
  return summary;
}

/** 失败清单压缩成一行，写进运行记录（status=partial 时可见），避免"部分失败仍报成功"。 */
function failuresSummary(failures, limit = 400) {
  if (!failures || failures.size === 0) return null;
  const parts = [...failures.entries()].map(([url, error]) => {
    const file = url.split("/").pop() ?? url;
    return file + "(" + String(error).slice(0, 60) + ")";
  });
  const text = failures.size + " 个文件抓取失败：" + parts.join("; ");
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
}

async function main() {
  const stats = { requests: 0, retried: 0, filesOk: 0, filesFailed: 0 };
  let all = [];
  let failures = new Map();
  try {
    ({ all, failures } = await collect(stats));
    await writeLocal(all, stats);
  } catch (e) {
    // 抓取阶段就失败：把运行记录写成 failed，避免 cron 侧一直停在 running
    if (DO_IMPORT && RUN_ID) {
      await postImport([], { runId: RUN_ID, status: "failed", fetched: all.length, error: String(e?.message ?? e).slice(0, 400) }).catch(() => {});
    }
    throw e;
  }

  if (!DO_IMPORT) {
    console.log(
      args["dry-run"]
        ? "[interview] --dry-run：跳过导入（链路自检通过）"
        : "[interview] 未传 --import：只落本地文件，未写库"
    );
    return;
  }

  const result = await postImport(all, {
    runId: RUN_ID || undefined,
    status: failures.size > 0 || all.length === 0 ? "partial" : "success",
    fetched: all.length,
    error: failuresSummary(failures),
    sourcesResult: crawlStats(stats),
  });
  console.log("[interview] 入库 " + result.imported + " 条（跳过 " + result.skipped + "，payload 内重复 " + result.duplicateInPayload + "）");
}

await main();
