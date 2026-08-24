#!/usr/bin/env node
/**
 * 招花 · 招聘信息浏览器爬虫（Node + Playwright 真实浏览器）
 *
 * 背景：2026 年各招聘站启用浏览器级 JS 风控（阿里云 WAF、火山引擎等），纯 HTTP 无法绕过。
 * 本脚本用真实 Chromium 执行 JS 过 WAF，直接解析渲染后的 DOM。
 * 实测：猎聘 / 智联 / 51job 可免登录抓取真实职位；Boss 直聘风控最严（空页），暂跳过。
 *
 * 职责：读取 job_crawler_configs（按账号合并）→ 真实浏览器抓取 → 规范化 →
 *       upsert job_postings（source+source_job_id 去重，content_hash 相同跳过 UPDATE）→ 写运行日志。
 *
 * 用法（容器内，cwd=仓库根）：
 *   node scripts/jobs_browser.mjs [--limit 60] [--timeout-min 25] [--dry-run]
 * 环境变量：
 *   PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD  数据库连接（容器内由 compose 注入）
 *   CHROMIUM_PATH   浏览器可执行文件（默认 /usr/bin/chromium，本地可指定 Chrome）
 *   PLAYWRIGHT_CORE_PATH  可选：playwright-core 安装目录（本地测试用）
 * 依赖：playwright-core（npm）、pg（npm）。容器内由 web 镜像安装；本地测试见 .local/pw-test。
 */
import { createRequire } from "node:module";
import { parseSalary, parsePublished, stripHtml, contentHash } from "./lib/normalize.js";
import { CITY_MAP } from "./lib/cities.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);

let chromium = null;
try {
  chromium = require("playwright-core").chromium;
} catch {
  const alt = process.env.PLAYWRIGHT_CORE_PATH;
  if (alt) {
    try { chromium = require(alt).chromium; } catch {}
  }
}
if (!chromium) {
  console.error("[fatal] 未找到 playwright-core，请安装（npm i playwright-core）或设置 PLAYWRIGHT_CORE_PATH");
  process.exit(1);
}
const { Pool } = require("pg");
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_KEYWORDS = ["前端工程师", "网络安全", "数据分析"];
const DEFAULT_PLATFORMS = ["liepin", "zhilian", "job51"];


// ---------- 工具 ----------
const enc = encodeURIComponent;
const num = (v) => (typeof v === "number" ? v : Number(v));


// ---------- 数据库 ----------
const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "Learn-Workbench",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  max: 5,
});

async function loadConfigs() {
  const { rows } = await pool.query(
    "SELECT keywords, cities, platforms, max_pages FROM job_crawler_configs WHERE enabled"
  );
  if (!rows.length) return [{ keywords: DEFAULT_KEYWORDS, cities: [], platforms: DEFAULT_PLATFORMS, max_pages: 1 }];
  return rows.map((r) => ({
    keywords: (r.keywords || []).filter(Boolean).map(String),
    cities: (r.cities || []).filter(Boolean).map(String),
    platforms: (r.platforms || []).filter((p) => DEFAULT_PLATFORMS.includes(p)),
    max_pages: Math.max(1, Number(r.max_pages) || 1),
  }));
}

async function existingKeys(platforms) {
  const { rows } = await pool.query(
    "SELECT source || '|' || source_job_id AS k FROM job_postings WHERE source = ANY($1::text[])",
    [platforms]
  );
  return new Set(rows.map((r) => r.k));
}

async function upsertRows(rows) {
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    let n = 1;
    for (const p of chunk) {
      values.push("($" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ")");
      params.push(p.source, p.source_job_id, p.title, p.company, p.city, p.district,
        p.salary_min, p.salary_max, p.salary_text, p.experience, p.education,
        JSON.stringify(p.tags), p.description, p.requirements, p.company_info,
        p.url, p.logo_url, p.published_at, p.content_hash, new Date().toISOString(), true);
    }
    const sql =
      "INSERT INTO job_postings (source, source_job_id, title, company, city, district, salary_min, salary_max, " +
      "salary_text, experience, education, tags, description, requirements, company_info, url, logo_url, " +
      "published_at, content_hash, fetched_at, is_active) VALUES " + values.join(",") +
      " ON CONFLICT (source, source_job_id) DO UPDATE SET title=EXCLUDED.title, company=EXCLUDED.company, " +
      "city=EXCLUDED.city, district=EXCLUDED.district, salary_min=EXCLUDED.salary_min, salary_max=EXCLUDED.salary_max, " +
      "salary_text=EXCLUDED.salary_text, experience=EXCLUDED.experience, education=EXCLUDED.education, " +
      "tags=EXCLUDED.tags, description=EXCLUDED.description, requirements=EXCLUDED.requirements, " +
      "company_info=EXCLUDED.company_info, url=EXCLUDED.url, logo_url=EXCLUDED.logo_url, " +
      "published_at=EXCLUDED.published_at, content_hash=EXCLUDED.content_hash, fetched_at=now(), is_active=true " +
      "WHERE job_postings.content_hash IS DISTINCT FROM EXCLUDED.content_hash";
    await pool.query(sql, params);
  }
}

async function createRun() {
  const { rows } = await pool.query("INSERT INTO job_crawler_runs (started_at, status) VALUES (now(), 'running') RETURNING id");
  return rows[0].id;
}
async function finishRun(id, status, platformsResult, fetched, fresh, error) {
  await pool.query(
    "UPDATE job_crawler_runs SET finished_at = now(), status = $1, platforms_result = $2, fetched_count = $3, new_count = $4, error = $5 WHERE id = $6",
    [status, JSON.stringify(platformsResult), fetched, fresh, error || null, id]
  );
}

// ---------- 站点抓取 ----------
function cleanTitle(t) {
  return String(t || "").replace(/【[^】]*】/g, "").replace(/急聘|急招|高薪|热门/g, "").replace(/\s+/g, " ").trim();
}

async function scrapeWithBrowser(ctx, site, kw, city, limit) {
  const page = await ctx.newPage();
  let out = [];
  try {
    const url = site.buildUrl(kw, city);
    await Promise.race([
      page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 }),
      new Promise((_, rj) => setTimeout(() => rj(new Error("goto-timeout")), 25000)),
    ]);
    await page.waitForTimeout(6000);
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) { window.scrollBy(0, 600); await new Promise((r) => setTimeout(r, 250)); }
    });
    await page.waitForTimeout(1500);
    for (const sel of site.selectors) {
      const cards = await page.$$(sel);
      if (!cards || cards.length === 0) continue;
      for (const card of cards.slice(0, limit)) {
        try {
          const data = await card.evaluate((root) => {
            const text = (root.innerText || "").replace(/\s+/g, " ").trim();
            const link = root.querySelector("a[href]");
            const href = link ? link.getAttribute("href") : "";
            const titleRaw = link ? (link.innerText || "").replace(/\s+/g, " ").trim() : text.slice(0, 40);
            return { text, href, titleRaw };
          });
          const item = site.parse(data);
          if (item && item.source_job_id && item.title) out.push(item);
        } catch {}
        if (out.length >= limit) break;
      }
      if (out.length) break;
    }
  } catch (e) {
    // 单个组合失败不中断
  } finally {
    await page.close().catch(() => {});
  }
  return out;
}

// ---------- 站点定义 ----------
// 公司名：取教育关键字后第一段中文/字母/数字串（各站卡片文本模式稳定）
function companyAfter(text, eduKw) {
  const i = text.indexOf(eduKw);
  if (i < 0) return "";
  const seg = text.slice(i + eduKw.length).trim();
  const m = seg.match(/^([\u4e00-\u9fa5A-Za-z0-9（）()·]+)/);
  return m ? m[1] : "";
}
// 薪资：优先 k 区间（如 90-120k·15薪），其次 万 区间，再次单 k
function salaryTextOf(text) {
  let m = text.match(/(\d+(?:\.\d+)?)\s*k\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*k[^\s【】]*/i);
  if (m) return m[0];
  // 90-120k 形式（k 只出现在第二个数）
  m = text.match(/(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*k[^\s【】]*/i);
  if (m) return m[0];
  m = text.match(/(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*万(?:\/月|\/年)?/);
  if (m) return m[0];
  m = text.match(/(\d+(?:\.\d+)?)\s*万(?:\/月|\/年)?/);
  if (m) return m[0];
  m = text.match(/(\d+(?:\.\d+)?)\s*k[^\s【】]*/i);
  if (m) return m[0];
  return "";
}

const SITES = {
  liepin: {
    name: "猎聘",
    buildUrl: (kw, city) => "https://www.liepin.com/zhaopin/?key=" + enc(kw) + (city ? "&dq=" + enc(city) : ""),
    selectors: [".job-card-pc-container", "[class*='job-card-pc-container']"],
    parse(d) {
      const t = d.text;
      const cityM = t.match(/【\s*([^【】\-]+?)\s*[-—]\s*([^【】]*?)\s*】/);
      const salary = salaryTextOf(t);
      const sm = parseSalary(salary);
      const expM = t.match(/(经验不限|在校|应届|1年以下|\d+-\d+年|\d+年以下|\d+年以上|\d+年)/);
      const eduM = t.match(/(博士|硕士|统招本科|本科|大专|学历不限)/);
      const edu = eduM ? eduM[1] : "";
      return {
        source: "liepin",
        source_job_id: (d.href.match(/job\/(\d+)/) || [])[1] || "",
        title: cleanTitle(d.titleRaw.split("【")[0]),
        company: edu ? companyAfter(t, edu) : "",
        city: cityM ? cityM[1].trim() : "",
        district: cityM ? cityM[2].trim() : "",
        salary_min: sm[0], salary_max: sm[1], salary_text: salary,
        experience: expM ? expM[0] : "", education: edu,
        tags: [], description: "", requirements: "", company_info: "",
        url: d.href.startsWith("http") ? d.href : "https://www.liepin.com" + d.href,
        logo_url: "", published_at: new Date().toISOString(),
      };
    },
  },
  zhilian: {
    name: "智联招聘",
    buildUrl: (kw, city) => "https://sou.zhaopin.com/?jl=" + ((CITY_MAP[city] || {}).zhilian || "489") + "&kw=" + enc(kw),
    selectors: [".job-card", "[class*='job-card']", ".joblist-box__item"],
    parse(d) {
      const t = d.text;
      const salary = salaryTextOf(t);
      const sm = salary.includes("**") ? [null, null] : parseSalary(salary);
      const expM = t.match(/(经验不限|在校|应届|1年以下|\d+-\d+年|\d+年以下|\d+年以上|\d+年)/);
      const eduM = t.match(/(博士|硕士|统招本科|本科|大专|学历不限)/);
      const edu = eduM ? eduM[1] : "";
      const cityM = t.match(/(北京|上海|广州|深圳|杭州|成都|西安|乌鲁木齐|南京|武汉|苏州|重庆|东莞|大连|长沙|郑州|青岛|天津)/);
      const compM = t.match(/([\u4e00-\u9fa5A-Za-z0-9（）()]{4,}(?:公司|集团|科技|信息|网络|数据|电子|智能|有限|证券|银行))/);
      const tags = t.split(/\s+/).filter((x) => /^[A-Za-z+#.]+$/.test(x)).slice(0, 8);
      return {
        source: "zhilian",
        source_job_id: (d.href.match(/(\d{8,})/) || [])[1] || "",
        title: cleanTitle(d.titleRaw),
        company: compM ? compM[1] : "",
        city: cityM ? cityM[1] : "", district: "",
        salary_min: sm[0], salary_max: sm[1], salary_text: salary || "面议",
        experience: expM ? expM[0] : "", education: edu,
        tags, description: "", requirements: "", company_info: "",
        url: d.href.startsWith("http") ? d.href : "https://sou.zhaopin.com" + d.href,
        logo_url: "", published_at: new Date().toISOString(),
      };
    },
  },
  job51: {
    name: "前程无忧",
    buildUrl: (kw, city) => "https://we.51job.com/pc/search?keyword=" + enc(kw) + "&searchType=2" + (city ? "&jobArea=" + ((CITY_MAP[city] || {}).job51 || "") : ""),
    selectors: [".joblist-item", "[class*='joblist-item']", ".j_joblist .e"],
    parse(d) {
      const t = d.text;
      const salary = salaryTextOf(t);
      const sm = parseSalary(salary);
      const cityM = t.match(/\s(北京|上海|广州|深圳|杭州|成都|西安|乌鲁木齐|南京|武汉|苏州|重庆|东莞|大连|长沙|郑州)\s/);
      const expM = t.match(/(经验不限|在校|应届|1年以下|\d+-\d+年|\d+年以下|\d+年以上|\d+年)/);
      const eduM = t.match(/(博士|硕士|本科|大专|学历不限)/);
      const edu = eduM ? eduM[1] : "";
      const compM = t.match(/([\u4e00-\u9fa5A-Za-z0-9（）()]{4,}(?:公司|集团|科技|信息|网络|数据|电子|智能|有限))/);
      const tags = t.split(/\s+/).filter((x) => /^[A-Za-z+#.]+$/.test(x)).slice(0, 8);
      return {
        source: "job51",
        source_job_id: (d.href.match(/job\/(\d+)/) || d.href.match(/(\d{8,})/) || [])[1] || "",
        title: cleanTitle(d.titleRaw),
        company: compM ? compM[1] : "",
        city: cityM ? cityM[1] : "", district: "",
        salary_min: sm[0], salary_max: sm[1], salary_text: salary || "面议",
        experience: expM ? expM[0] : "", education: edu,
        tags, description: "", requirements: "", company_info: "",
        url: d.href.startsWith("http") ? d.href : "https://we.51job.com" + d.href,
        logo_url: "", published_at: new Date().toISOString(),
      };
    },
  },
};

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const fsmod = require("node:fs");
  const candidates = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"];
  return candidates.find((p) => fsmod.existsSync(p)) || null;
}

// ---------- 登录态 / 代理 ----------
function resolveStorageState(explicit) {
  const fsmod = require("node:fs");
  const cands = [];
  if (explicit) cands.push(explicit);
  if (process.env.JOBS_STORAGE_STATE) cands.push(process.env.JOBS_STORAGE_STATE);
  cands.push(path.join(REPO_ROOT, "config", "job-hosts", "storageState.json"));
  return cands.find((p) => p && fsmod.existsSync(p)) || null;
}

// ---------- 主流程 ----------
async function main() {
  const args = process.argv.slice(2);
  const flag = (name, d) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? d) : d; };
  const has = (name) => args.includes(name);
  const LIMIT = Number(flag("--limit", 60));
  const TIMEOUT_MIN = Number(flag("--timeout-min", 25));
  const DRY = has("--dry-run");
  const PROXY = flag("--proxy", "") || process.env.JOBS_PROXY || "";
  const storageStateFile = resolveStorageState(flag("--storage-state", ""));
  if (storageStateFile) console.log("[info] 复用登录态 Cookie：%s", storageStateFile);
  if (PROXY) console.log("[info] 使用代理：%s", PROXY);

  const started = Date.now();
  const deadline = Date.now() + TIMEOUT_MIN * 60000;
  const runId = DRY ? null : await createRun();

  try {
    const configs = await loadConfigs();
    const combos = new Set();
    const platforms = new Set();
    for (const c of configs) {
      for (const p of (c.platforms || [])) {
        platforms.add(p);
        for (const kw of (c.keywords || [])) {
          for (const city of (c.cities || [""])) combos.add(JSON.stringify([p, kw, city]));
        }
      }
    }
    let combosList = [...combos].map((s) => JSON.parse(s));
    if (!combosList.length) {
      for (const p of DEFAULT_PLATFORMS) for (const kw of DEFAULT_KEYWORDS) combosList.push([p, kw, ""]);
    }
    console.log("[info] 浏览器爬虫：组合 %d 个，平台 %s，limit=%d", combosList.length, [...platforms].join(","), LIMIT);

    const chrome = chromiumPath();
    if (!chrome) throw new Error("未找到 Chromium 可执行文件（设置 CHROMIUM_PATH）");
    const browser = await chromium.launch({
      executablePath: chrome, headless: true,
      proxy: PROXY ? { server: PROXY } : undefined,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const ctx = await browser.newContext({
      userAgent: UA, locale: "zh-CN", viewport: { width: 1440, height: 1600 },
      storageState: storageStateFile || undefined,
    });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      try { window.chrome = window.chrome || { runtime: {} }; } catch {}
    });

    const allRows = [];
    const platformResult = {};
    const errors = [];
    for (const [src, kw, city] of combosList) {
      const site = SITES[src];
      if (!site) continue;
      if (Date.now() > deadline) { errors.push(src + ":" + kw + " 跳过（超时）"); break; }
      const rows = await scrapeWithBrowser(ctx, site, kw, city, Math.min(LIMIT, 50));
      console.log("[ok] %s x %s x %s -> %d 条", site.name, kw, city || "全国", rows.length);
      allRows.push(...rows);
      platformResult[src] = (platformResult[src] || 0) + rows.length;
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
    }
    await browser.close().catch(() => {});

    const normalized = allRows.map((r) => {
      const p = {
        ...r,
        title: String(r.title || "").slice(0, 120),
        company: String(r.company || "").slice(0, 120),
        city: String(r.city || "").slice(0, 40),
        district: String(r.district || "").slice(0, 60),
        salary_text: String(r.salary_text || "").slice(0, 60),
        experience: String(r.experience || "").slice(0, 30),
        education: String(r.education || "").slice(0, 30),
        tags: (r.tags || []).map((x) => String(x).slice(0, 40)).slice(0, 10),
        description: stripHtml(r.description || "").slice(0, 5000),
        requirements: stripHtml(r.requirements || "").slice(0, 3000),
        company_info: stripHtml(r.company_info || "").slice(0, 500),
        url: String(r.url || "").slice(0, 500),
        logo_url: String(r.logo_url || "").slice(0, 500),
        published_at: parsePublished(r.published_at),
      };
      p.content_hash = contentHash(p);
      return p;
    });
    const dedup = new Map();
    for (const p of normalized) dedup.set(p.source + "|" + p.source_job_id, p);
    const rows = [...dedup.values()];

    if (DRY) {
      console.log("[dry-run] 共 %d 行（不写库）", rows.length);
      for (const r of rows.slice(0, 5)) {
        console.log("  -", r.source, r.title, r.company, r.city, r.salary_text, r.url.slice(0, 70));
      }
    } else {
      const sources = [...new Set(rows.map((r) => r.source))];
      const existing = await existingKeys(sources);
      const fresh = rows.filter((r) => !existing.has(r.source + "|" + r.source_job_id)).length;
      await upsertRows(rows);
      // 清掉市场分析缓存（market_stats 60s TTL，避免爬虫后读到旧数据）
      await pool.query("DELETE FROM market_stats WHERE key = 'full'").catch(() => {});
      const status = rows.length === 0 ? "partial" : "success";
      await finishRun(runId, status, platformResult, rows.length, fresh, errors.length ? errors.slice(0, 5).join("；") : null);
      console.log("[done] status=%s fetched=%d new=%d 用时=%ss platforms=%s",
        status, rows.length, fresh, ((Date.now() - started) / 1000).toFixed(1), JSON.stringify(platformResult));
    }
  } catch (e) {
    console.error("[error]", e && e.message);
    if (runId) await finishRun(runId, "failed", {}, 0, 0, String((e && e.message) || e));
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
