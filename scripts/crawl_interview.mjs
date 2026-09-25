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
 *
 * 合规约定（用户已确认「抓公开内容、保留来源」）：
 *  - 只抓公开仓库的 markdown（经 jsDelivr CDN 读取，不绕任何反爬）；
 *  - 每条都带 sourceUrl / sourceSite / license，入库后可一键下架（is_listed）；
 *  - 只存「问题 + 答案文本」，不搬运图片等资源；
 *  - 抓取限速，且只取每个文件里结构清晰的问答标题。
 *
 * 去重口径（v1.26 起**由服务端负责**，见 apps/web/lib/interview/import-core.ts）：
 *  归一化 = 全角空格→半角 + 转小写 + 去掉所有空白；external_key = <sourceSite>#<sha1(归一化题目前 16 位)>。
 *  脚本侧只保留同一份归一化规则用于"同一次 payload 内去重"（下方 normalizeQuestion 是它的镜像），
 *  **不再自己算 externalKey** —— 历史 611 条是按原始文本算键的，若客户端各算各的，
 *  重爬会插出第二份；服务端按题目归一化判重才能真正保证「题目不重复」。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
const TOTAL_LIMIT = Number(args.limit ?? 400);
const FILE_LIMIT = Number(args.files ?? 120);
/** 单次 POST 的条目数（服务端还会再按 1000 自动分块，这里只是控制请求体大小与超时） */
const BATCH_SIZE = Math.max(1, Number(args.batch ?? 300));
const RUN_ID = Number(args["run-id"]) || 0;
const DO_IMPORT = Boolean(args.import) && !args["dry-run"];
const FROM_FILE = typeof args["from-file"] === "string" ? args["from-file"] : "";
const API_BASE = String(args.api ?? process.env.LWB_API_URL ?? "http://127.0.0.1:" + (process.env.APP_PORT ?? "3001")).replace(/\/+$/, "");
const CRON_SECRET = (process.env.CRON_SECRET ?? "").trim();
const UA = { "user-agent": "Mozilla/5.0 (compatible; LWB-InterviewCrawler/1.0)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    include: /^docs\/(java|database|cs-basics|distributed-system|system-design|open-source-project|interview-preparation)\//,
    moduleOf: (file) => {
      const seg = file.replace(/^docs\//, "").split("/");
      const area = seg[0] ?? "其他";
      const sub = seg[1] ?? "";
      const map = {
        java: "Java", database: "数据库", "cs-basics": "计算机基础",
        "distributed-system": "分布式与高并发", "system-design": "系统设计",
        "interview-preparation": "面试准备", "open-source-project": "项目经验",
      };
      const areaName = map[area] ?? area;
      const subName = SUB_NAME[sub.replace(/\.md$/, "")] ?? sub.replace(/\.md$/, "");
      return subName && subName.length <= 12 ? areaName + " · " + subName : areaName;
    },
  },
];

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return res.text();
}

/** jsDelivr 文件清单（flat 结构），便于只挑 markdown */
async function listFiles(source) {
  const url = "https://data.jsdelivr.com/v1/packages/gh/" + source.repo + "@" + source.ref + "?structure=flat";
  const data = JSON.parse(await fetchText(url));
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
  if (batches.length === 0) batches.push([]);

  for (let i = 0; i < batches.length; i++) {
    const last = i === batches.length - 1;
    const body = { items: batches[i] };
    if (last && run) body.run = run;
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
  return { imported, skipped, duplicateInPayload };
}

/** 抓取（默认网络；--from-file 时只读本地文件，用于离线自检） */
async function collect() {
  const all = [];
  const seen = new Set();

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
    return all;
  }

  for (const source of SOURCES) {
    let files = [];
    try {
      files = await listFiles(source);
    } catch (e) {
      console.warn("[interview] 文件清单失败：" + source.repo + " " + e.message);
      continue;
    }
    console.log("[interview] " + source.repo + " 命中 " + files.length + " 个 markdown（取前 " + FILE_LIMIT + "）");
    for (const file of files.slice(0, FILE_LIMIT)) {
      if (all.length >= TOTAL_LIMIT) break;
      let md = "";
      try {
        md = await fetchText(rawUrl(source, file));
      } catch {
        continue;
      }
      const module = source.moduleOf(file);
      const tags = file.replace(/^docs\//, "").split("/").slice(0, 3).map((s) => s.replace(/\.md$/, ""));
      const items = parseQA(md, { module, tags, sourceUrl: blobUrl(source, file), sourceSite: source.sourceSite, license: source.license });
      const fresh = dedupe(items, seen);
      let added = 0;
      for (const item of fresh) {
        if (all.length >= TOTAL_LIMIT) break;
        all.push(item);
        added++;
      }
      if (added > 0) console.log("  +" + String(added).padStart(3) + " " + module + "  ← " + file);
      await sleep(160);
    }
  }
  return all;
}

async function writeLocal(all) {
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
}

async function main() {
  let all = [];
  try {
    all = await collect();
    await writeLocal(all);
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

  const stats = await postImport(all, {
    runId: RUN_ID || undefined,
    status: all.length > 0 ? "success" : "partial",
    fetched: all.length,
  });
  console.log("[interview] 入库 " + stats.imported + " 条（跳过 " + stats.skipped + "，payload 内重复 " + stats.duplicateInPayload + "）");
}

await main();
