#!/usr/bin/env node
/**
 * 招花 · 官方信息源爬虫（考公考编 + 央国企）
 * 读取 job_crawler_sources（hosts 注册表落库）→ 按 engine 分发：
 *   - http 引擎：fetch + simple-dom（静态政府站）
 *   - browser 引擎：Playwright 真实 Chromium（JS/SPA/WAF 站）
 * 产出：job_postings（公告/职位）+ job_exam_events（考试日历）+ 订阅命中通知 + 健康度
 * 用法：node scripts/jobs_official.mjs [--limit N] [--timeout-min M] [--dry-run] [--sources a,b]
 * 环境变量：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD, CHROMIUM_PATH, PLAYWRIGHT_CORE_PATH
 */
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

import { parseHtml, queryAll, textContent, attr, cleanText } from "./lib/simple-dom.js";
import { parseExamEvents, parseRecruitCount, findAttachmentLinks, parseCnDate } from "./lib/announcement.js";
import { readXlsx } from "./lib/xlsx-min.js";
import { stripHtml, contentHash } from "./lib/normalize.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const ALL_CATEGORIES = ["internet", "gongkao", "gongbian", "yangqi"];

// ---------- 工具 ----------
const md5 = (s) => createHash("md5").update(String(s), "utf8").digest("hex");



function parseDateText(s) {
  if (!s) return null;
  const t = String(s).replace(/[\[\]()（）]/g, " ").trim();
  const m = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m2 = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** 解析详情页正文里的截止时间（多个候选，取最早的未来/最近） */
function pickDeadline(events) {
  if (!events || events.length === 0) return null;
  const end = events.find((e) => e.kind === "apply_end");
  if (end) return end.eventAt;
  return null;
}

async function fetchText(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    let charset = (r.headers.get("content-type") || "").match(/charset=([\w-]+)/i);
    if (!charset) {
      const head = buf.subarray(0, 2048).toString("latin1");
      const m = head.match(/charset=["']?([\w-]+)/i);
      if (m) charset = m[1];
    }
    try {
      return new TextDecoder(charset ? charset[1] : "utf-8").decode(buf);
    } catch {
      return buf.toString("utf8");
    }
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 数据库 ----------
const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "Learn-Workbench",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  max: 5,
});

async function loadSources(onlyIds) {
  const { rows } = await pool.query(
    "SELECT * FROM job_crawler_sources WHERE enabled"
  );
  const list = rows.map((r) => ({
    id: r.id, category: r.category, channel: r.channel, name: r.name,
    engine: r.engine, base_url: r.base_url || "",
    list: typeof r.list_config === "object" ? r.list_config : {},
    detail: typeof r.detail_config === "object" ? r.detail_config : {},
    deadline_parse: !!r.deadline_parse,
    rate_limit_ms: Number(r.rate_limit_ms || 3000),
    max_items_per_run: Number(r.max_items_per_run || 20),
    max_pages: Number(r.max_pages || 1),
    risk: r.risk || "L1",
    enabled: !!r.enabled,
    note: r.note || "",
  }));
  if (onlyIds && onlyIds.length) return list.filter((s) => onlyIds.includes(s.id));
  return list;
}

/** 按账号配置合并出「要抓的源」（类别/白名单过滤） */
async function activeSources(sources) {
  const { rows } = await pool.query(
    "SELECT categories, provinces, sources FROM job_crawler_configs WHERE enabled"
  );
  let cats = new Set(ALL_CATEGORIES);
  let whitelist = new Set();
  let anyConfig = false;
  for (const r of rows) {
    anyConfig = true;
    const c = Array.isArray(r.categories) ? r.categories.map(String) : [];
    if (c.length) cats = new Set([...cats].filter((x) => c.includes(x)));
    const w = Array.isArray(r.sources) ? r.sources.map(String).filter(Boolean) : [];
    for (const id of w) whitelist.add(id);
  }
  if (!anyConfig) {
    // 无任何配置：默认只抓非互联网官方源（互联网由 jobs_browser.mjs 负责）
    return sources.filter((s) => s.category !== "internet");
  }
  const active = sources.filter((s) => {
    if (s.category === "internet") return false; // 互联网平台由 jobs_browser.mjs 处理
    if (!cats.has(s.category)) return false;
    if (whitelist.size > 0 && !whitelist.has(s.id)) return false;
    return true;
  });
  return active;
}

async function existingKeys(sources) {
  const { rows } = await pool.query(
    "SELECT source || '|' || source_job_id AS k FROM job_postings WHERE source = ANY($1::text[])",
    [sources]
  );
  return new Set(rows.map((r) => r.k));
}

async function upsertRows(rows) {
  const CHUNK = 40;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    let n = 1;
    for (const p of chunk) {
      values.push(
        "($" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) +
        ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) +
        ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) +
        ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ",$" + (n++) + ")"
      );
      params.push(
        p.source, p.source_job_id, p.title, p.company, p.city, p.district,
        p.salary_min, p.salary_max, p.salary_text, p.experience, p.education,
        JSON.stringify(p.tags), p.description, p.requirements, p.company_info,
        p.url, p.logo_url || "", p.category, p.channel, p.deadline_at,
        JSON.stringify(p.extra), p.published_at, p.content_hash, new Date().toISOString(), true
      );
    }
    const sql =
      "INSERT INTO job_postings (source, source_job_id, title, company, city, district, salary_min, salary_max, " +
      "salary_text, experience, education, tags, description, requirements, company_info, url, logo_url, " +
      "category, channel, deadline_at, extra, published_at, content_hash, fetched_at, is_active) VALUES " +
      values.join(",") +
      " ON CONFLICT (source, source_job_id) DO UPDATE SET title=EXCLUDED.title, company=EXCLUDED.company, " +
      "city=EXCLUDED.city, district=EXCLUDED.district, salary_min=EXCLUDED.salary_min, salary_max=EXCLUDED.salary_max, " +
      "salary_text=EXCLUDED.salary_text, experience=EXCLUDED.experience, education=EXCLUDED.education, " +
      "tags=EXCLUDED.tags, description=EXCLUDED.description, requirements=EXCLUDED.requirements, " +
      "company_info=EXCLUDED.company_info, url=EXCLUDED.url, logo_url=EXCLUDED.logo_url, " +
      "category=EXCLUDED.category, channel=EXCLUDED.channel, deadline_at=EXCLUDED.deadline_at, extra=EXCLUDED.extra, " +
      "published_at=EXCLUDED.published_at, content_hash=EXCLUDED.content_hash, fetched_at=now(), is_active=true " +
      "WHERE job_postings.content_hash IS DISTINCT FROM EXCLUDED.content_hash RETURNING source_job_id";
    const res = await pool.query(sql, params);
    inserted += res.rowCount || 0;
  }
  return inserted;
}

async function createRun() {
  const { rows } = await pool.query(
    "INSERT INTO job_crawler_runs (started_at, status) VALUES (now(), 'running') RETURNING id"
  );
  return rows[0].id;
}
async function finishRun(id, status, sourcesResult, fetched, fresh, error) {
  await pool.query(
    "UPDATE job_crawler_runs SET finished_at = now(), status = $1, sources_result = $2, fetched_count = $3, new_count = $4, error = $5 WHERE id = $6",
    [status, JSON.stringify(sourcesResult), fetched, fresh, error || null, id]
  );
}

// ---------- HTTP 引擎 ----------
function resolveUrl(href, baseUrl) {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return baseUrl + (href.startsWith("/") ? "" : "/") + href;
  }
}

function extractListItems(src, htmlText, pageBase) {
  const list = src.list || {};
  const items = [];
  const root = parseHtml(htmlText);
  const nodes = queryAll(root, list.item_selector || "ul li");
  const titleFilter = (src.list.title_filter || src.title_filter) ? new RegExp(src.list.title_filter || src.title_filter) : null;
  for (const node of nodes) {
    const a = queryAll(node, list.title_selector || "a")[0] || node;
    let title = cleanText(attr(a, "title") || textContent(a));
    if (!title || title.length < 4 || title.includes("$article") || title.includes("$")) continue;
    if (titleFilter && !titleFilter.test(title)) continue;
    const href = resolveUrl(attr(a, "href"), pageBase);
    if (!href || href === pageBase) continue;
    const dNode = list.date_selector ? queryAll(node, list.date_selector)[0] : null;
    const date = dNode ? cleanText(textContent(dNode)) : "";
    const company = cleanText(textContent(node)).split(title)[0] || "";
    items.push({ title, url: href, date, nodeText: cleanText(textContent(node)).slice(0, 200) });
  }
  // 去重
  const seen = new Set();
  return items.filter((it) => {
    const k = it.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchDetailHttp(src, url) {
  try {
    const html = await fetchText(url, 20000);
    const root = parseHtml(html);
    const bodySel = (src.detail && src.detail.body_selector) || ".content, .TRS_Editor, .article";
    let bodyNode = null;
    for (const sel of bodySel.split(",").map((s) => s.trim()).filter(Boolean)) {
      bodyNode = queryAll(root, sel)[0] || null;
      if (bodyNode) break;
    }
    const body = bodyNode ? cleanText(textContent(bodyNode)) : stripHtml(html).slice(0, 6000);
    return { html, body };
  } catch (e) {
    return { html: "", body: "", error: e && e.message ? e.message : String(e) };
  }
}

async function downloadXlsx(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return readXlsx(buf);
  } catch {
    return null;
  }
}

/** 把岗位表 excel 行转成职位行（公告→岗位结构化） */
function rowsFromExcel(rows, src, announce) {
  if (!rows || rows.length < 2) return [];
  const header = (rows[0] || []).map((h) => String(h || "").trim());
  const findCol = (keys) => {
    const idx = header.findIndex((h) => keys.some((k) => h.includes(k)));
    return idx >= 0 ? idx : -1;
  };
  const cTitle = findCol(["岗位名称", "职位名称", "招聘岗位", "岗位"]);
  const cCompany = findCol(["单位名称", "招聘单位", "用人单位", "单位"]);
  const cCity = findCol(["工作地点", "工作地区", "城市", "地区"]);
  const cEdu = findCol(["学历", "学位"]);
  const cExp = findCol(["工作经验", "工作经历", "经验"]);
  const cCount = findCol(["招聘人数", "招录人数", "人数"]);
  const out = [];
  for (const row of rows.slice(1)) {
    const get = (idx) => (idx >= 0 ? String(row[idx] || "").trim() : "");
    const title = get(cTitle) || get(cCompany);
    if (!title) continue;
    out.push({
      source: src.id + "-position",
      source_job_id: md5(announce.url + "|" + row.join("|")),
      title,
      company: get(cCompany) || announce.company || src.name,
      city: get(cCity),
      district: "",
      salary_min: null, salary_max: null, salary_text: "面议",
      experience: get(cExp), education: get(cEdu),
      tags: [],
      description: "来源于公告《" + announce.title + "》岗位表",
      requirements: "", company_info: "",
      url: announce.url,
      logo_url: "",
      category: src.category,
      channel: "job",
      deadline_at: announce.deadline_at,
      extra: { from_announcement: announce.title, recruit_count: get(cCount), parent_url: announce.url },
      published_at: announce.published_at,
    });
  }
  return out;
}

/** HTTP 源抓取：列表 + 详情（公告）/ 职位列表 */
async function crawlHttpSource(src, limit) {
  const list = src.list || {};
  const pageBase = list.url;
  const html = await fetchText(pageBase, 25000);
  const items = extractListItems(src, html, src.base_url || pageBase);
  const rows = [];
  const eventsByKey = new Map();
  const max = Math.min(limit, src.max_items_per_run || 20, items.length);
  for (const it of items.slice(0, max)) {
    const detail = src.channel === "announcement" ? await fetchDetailHttp(src, it.url) : { html: "", body: "", error: "" };
    const body = detail.body || "";
    const events = src.deadline_parse ? parseExamEvents(body + " " + it.title) : [];
    const deadline = pickDeadline(events);
    const recruit = parseRecruitCount(body);
    const attachments = detail.html ? findAttachmentLinks(detail.html, it.url) : [];
    const extra = {};
    if (recruit) extra.recruit_count = recruit;
    if (attachments.length) {
      extra.attachments = attachments.map((a) => a.url);
      extra.attachment_names = attachments.map((a) => a.name);
    }
    const row = {
      source: src.id,
      source_job_id: md5(it.url),
      title: it.title.slice(0, 200),
      company: (src.name || "").slice(0, 120),
      city: src.list?.city || "", district: src.list?.district || "",
      salary_min: null, salary_max: null, salary_text: "",
      experience: "", education: "",
      tags: [src.category === "yangqi" ? "央国企" : src.category === "gongbian" ? "事业编" : "考公", src.channel === "announcement" ? "公告" : "职位"],
      description: body.slice(0, 5000),
      requirements: "", company_info: "",
      url: it.url.slice(0, 500),
      logo_url: "",
      category: src.category,
      channel: src.channel === "job" ? "job" : "announcement",
      deadline_at: deadline,
      extra,
      published_at: parseDateText(it.date),
    };
    row.content_hash = contentHash(row);
    rows.push(row);
    if (events.length) eventsByKey.set(it.url, events);

    // 公告→岗位表结构化
    if (attachments.length > 0 && rows.length < 5) {
      for (const att of attachments.slice(0, 2)) {
        const excel = await downloadXlsx(att.url);
        if (excel) {
          const pos = rowsFromExcel(excel, src, row);
          for (const p of pos) {
            p.content_hash = contentHash(p);
            rows.push(p);
          }
          if (pos.length) extra.position_count = pos.length;
          break;
        }
      }
    }
    await new Promise((r) => setTimeout(r, src.rate_limit_ms || 2000));
  }
  return { rows, eventsByKey };
}

// ---------- Browser 引擎 ----------
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const fsmod = require("node:fs");
  const candidates = [
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  return candidates.find((p) => fsmod.existsSync(p)) || null;
}

let chromium = null;
try {
  chromium = require("playwright-core").chromium;
} catch {
  const alt = process.env.PLAYWRIGHT_CORE_PATH;
  if (alt) {
    try {
      chromium = require(alt).chromium;
    } catch {}
  }
}

async function scrapeListWithBrowser(page, src) {
  const list = src.list || {};
  await Promise.race([
    page.goto(list.url, { waitUntil: "domcontentloaded", timeout: 30000 }),
    new Promise((_, rj) => setTimeout(() => rj(new Error("goto-timeout")), 30000)),
  ]);
  await page.waitForTimeout(5000);
  await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      window.scrollBy(0, 500);
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  await page.waitForTimeout(1500);
  const items = await page.evaluate((cfg) => {
    const sel = cfg.item_selector || "ul li";
    const titleSel = cfg.title_selector || "a";
    const urlSel = cfg.url_selector || "a[href]";
    const dateSel = cfg.date_selector || "";
    const titleFilter = cfg.title_filter ? new RegExp(cfg.title_filter) : null;
    const out = [];
    const nodes = document.querySelectorAll(sel);
    for (const node of Array.from(nodes).slice(0, 40)) {
      const a = node.querySelector(titleSel) || node;
      const title = (a.getAttribute("title") || a.innerText || "").replace(/\s+/g, " ").trim();
      if (!title || title.length < 4 || title.includes("$article") || title.includes("$")) continue;
      if (titleFilter && !titleFilter.test(title)) continue;
      const href = (a.getAttribute("href") || "").trim();
      if (!href) continue;
      const dNode = dateSel ? node.querySelector(dateSel) : null;
      const date = dNode ? (dNode.innerText || "").replace(/\s+/g, " ").trim() : "";
      out.push({ title, url: href, date });
    }
    return out;
  }, list);
  // 解析相对 URL
  const base = src.base_url || list.url;
  return items.map((it) => ({ ...it, url: resolveUrl(it.url, base) }));
}

async function fetchDetailWithBrowser(page, src, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    const bodySel = (src.detail && src.detail.body_selector) || ".content, .TRS_Editor, .article";
    const data = await page.evaluate((sel) => {
      for (const s of sel.split(",").map((x) => x.trim()).filter(Boolean)) {
        const n = document.querySelector(s);
        if (n) return { html: n.outerHTML, body: n.innerText.replace(/\s+/g, " ").trim() };
      }
      return { html: "", body: document.body ? document.body.innerText.slice(0, 8000) : "" };
    }, bodySel);
    return data;
  } catch (e) {
    return { html: "", body: "", error: e && e.message ? e.message : String(e) };
  }
}

async function crawlIguopinApi(page, src, limit) {
  // 国聘网：拦截 recom-job 接口，注入城市 district，解析 JSON（比 DOM 稳）
  const apiCfg = (src.list && src.list.api) || {};
  const districts = Object.values(apiCfg.districts || {}).filter(Boolean);
  const pageUrl = apiCfg.page_url || (src.list && src.list.url) || "https://www.iguopin.com/job?channel=social";
  const rows = [];
  const seenIds = new Set();
  let currentDistrict = "";
  page.on("response", async (r) => {
    try {
      if (!r.url().includes("/api/jobs/v1/recom-job")) return;
      const j = await r.json();
      const list = (j && j.data && j.data.list) || [];
      for (const it of list) {
        const jid = String(it.job_id || "");
        if (!jid || seenIds.has(jid)) continue;
        seenIds.add(jid);
        const dlist = it.district_list || [];
        const firstArea = String((dlist[0] && dlist[0].area_cn) || "");
        const city = (firstArea.split("-")[0] || "").trim();
        const districtCn = firstArea.includes("-") ? firstArea.split("-").slice(1).join("-") : firstArea;
        const isNeg = !!it.is_negotiable;
        const wMin = it.min_wage != null ? Number(it.min_wage) : null;
        const wMax = it.max_wage != null ? Number(it.max_wage) : null;
        const row = {
          source: "iguopin",
          source_job_id: String(it.job_id || ""),
          title: String(it.job_name || "").slice(0, 200),
          company: String(it.company_name || "").slice(0, 120),
          city: city || "成都", district: districtCn,
          salary_min: wMin, salary_max: wMax,
          salary_text: isNeg ? "面议" : (wMin != null && wMax != null ? `${wMin}-${wMax}${it.wage_unit_cn || ""}` : ""),
          experience: it.experience_cn || "", education: it.education_cn || "",
          tags: [it.nature_cn || "职位", it.recruitment_type_cn || "社招"].filter(Boolean),
          category: src.category || "yangqi",
          channel: src.channel === "announcement" ? "announcement" : "job",
          description: "", requirements: "", company_info: "",
          url: `https://www.iguopin.com/job/detail?id=${it.job_id}`,
          logo_url: "",
          deadline_at: null,
          extra: {},
          published_at: it.start_time ? new Date(String(it.start_time).replace(/-/g, "/")).toISOString() : new Date().toISOString(),
        };
        row.content_hash = contentHash(row);
        rows.push(row);
      }
    } catch {}
  });
  await page.route("**/api/jobs/v1/recom-job", async (route) => {
    try {
      const req = route.request();
      let body = {};
      try { body = req.postDataJSON() || {}; } catch {}
      if (currentDistrict) {
        body.search = body.search || {};
        body.search.district = [currentDistrict];
      }
      await route.continue({ postData: JSON.stringify(body) });
    } catch {}
  }).catch(() => {});
  const targets = districts.length ? districts : [""];
  for (let i = 0; i < targets.length; i++) {
    currentDistrict = targets[i];
    const bust = (pageUrl.includes("?") ? "&" : "?") + "_xr=" + i + "_" + Date.now();
    await page.goto(pageUrl + bust, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(7000);
    await page.evaluate(async () => { for (let k = 0; k < 8; k++) { window.scrollBy(0, 600); await new Promise((r) => setTimeout(r, 200)); } }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  // 多区域收集时不能按先后截断：早期成都/北上广会占满 slice，后期 乌鲁木齐/新疆/重庆 会被裁掉
  // recom-job 每区固定 page_size=20，全区域去重后上限约 districts*20，这里放宽到全部保留，避免地区失衡
  const out = rows.slice(0, Math.max(limit || 30, targets.length * 25));
  return { rows: out, eventsByKey: new Map() };
}

async function crawlBrowserSource(page, src, limit) {
  const apiCfg = src.list && src.list.api;
  if (apiCfg && apiCfg.mode === "iguopin-recom") {
    return await crawlIguopinApi(page, src, limit);
  }
  const items = await scrapeListWithBrowser(page, src);
  const rows = [];
  const eventsByKey = new Map();
  const max = Math.min(limit, src.max_items_per_run || 20, items.length);
  for (const it of items.slice(0, max)) {
    const detail = src.channel === "announcement"
      ? await fetchDetailWithBrowser(page, src, it.url)
      : { html: "", body: it.title };
    const body = detail.body || "";
    const events = src.deadline_parse ? parseExamEvents(body + " " + it.title) : [];
    const deadline = pickDeadline(events);
    const recruit = parseRecruitCount(body);
    const extra = {};
    if (recruit) extra.recruit_count = recruit;
    const row = {
      source: src.id,
      source_job_id: md5(it.url),
      title: it.title.slice(0, 200),
      company: (src.name || "").slice(0, 120),
      city: src.list?.city || "", district: src.list?.district || "",
      salary_min: null, salary_max: null, salary_text: "",
      experience: "", education: "",
      tags: [src.category === "yangqi" ? "央国企" : src.category === "gongbian" ? "事业编" : "考公", src.channel === "announcement" ? "公告" : "职位"],
      description: body.slice(0, 5000),
      requirements: "", company_info: "",
      url: it.url.slice(0, 500),
      logo_url: "",
      category: src.category,
      channel: src.channel === "job" ? "job" : "announcement",
      deadline_at: deadline,
      extra,
      published_at: parseDateText(it.date),
    };
    row.content_hash = contentHash(row);
    rows.push(row);
    if (events.length) eventsByKey.set(it.url, events);
    await new Promise((r) => setTimeout(r, (src.rate_limit_ms || 3000) / 2));
  }
  return { rows, eventsByKey };
}


// ---------- 健康度 ----------
async function recordHealth(srcId, fetched, error) {
  const hit = fetched > 0 ? 1 : 0;
  await pool.query(
    "INSERT INTO job_source_health (source, fetched, hit_rate, error) VALUES ($1, $2, $3, $4)",
    [srcId, fetched, hit, error || ""]
  );
  await pool.query(
    `UPDATE job_crawler_sources SET
       hit_rate = round(0.7 * COALESCE(hit_rate, 1) + 0.3 * $2, 3),
       last_run_at = now(), last_error = $3
     WHERE id = $1`,
    [srcId, hit, error || ""]
  );
}

// ---------- 考试日历 ----------
async function insertExamEvents(rows, eventsByKey) {
  if (!eventsByKey || eventsByKey.size === 0) return 0;
  let inserted = 0;
  const urlToId = new Map();
  for (const r of rows) {
    if (r.channel === "announcement") urlToId.set(r.url, null);
  }
  if (urlToId.size === 0) return 0;
  const urls = [...urlToId.keys()];
  const { rows: found } = await pool.query(
    "SELECT id, url FROM job_postings WHERE channel = 'announcement' AND url = ANY($1::text[])",
    [urls]
  );
  for (const f of found) urlToId.set(f.url, f.id);
  for (const [url, events] of eventsByKey.entries()) {
    const jobId = urlToId.get(url);
    if (!jobId) continue;
    for (const e of events) {
      await pool.query(
        `INSERT INTO job_exam_events (job_id, source, kind, label, event_at, note)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (job_id, kind, event_at) DO NOTHING`,
        [jobId, "official", e.kind, e.label, e.eventAt, e.note || ""]
      );
      inserted++;
    }
  }
  return inserted;
}

// ---------- 订阅命中通知 ----------
async function matchSubscriptions(newRows) {
  if (!newRows || newRows.length === 0) return 0;
  const { rows: subs } = await pool.query(
    "SELECT id, user_id, categories, keywords, cities FROM job_subscriptions WHERE enabled"
  );
  if (subs.length === 0) return 0;
  let count = 0;
  for (const r of newRows) {
    const { rows: jr } = await pool.query(
      "SELECT id FROM job_postings WHERE source = $1 AND source_job_id = $2 LIMIT 1",
      [r.source, r.source_job_id]
    );
    const jobId = jr[0] ? jr[0].id : null;
    if (!jobId) continue;
    const title = r.title || "";
    const company = r.company || "";
    const category = r.category || "";
    const city = r.city || "";
    const district = r.district || "";
    const tags = (r.tags || []).join(" ");
    const desc = (r.description || "").slice(0, 1000);
    for (const s of subs) {
      const cats = Array.isArray(s.categories) ? s.categories : [];
      const kws = Array.isArray(s.keywords) ? s.keywords.map(String) : [];
      const cities = Array.isArray(s.cities) ? s.cities.map(String) : [];
      if (cats.length && !cats.includes(category)) continue;
      if (cities.length && city && !cities.includes(city) && !cities.includes(district)) continue;
      if (kws.length) {
        const hay = (title + " " + company + " " + tags + " " + desc).toLowerCase();
        if (!kws.some((k) => k && hay.includes(String(k).toLowerCase()))) continue;
      }
      const label = category === "yangqi" ? "央国企" : category === "gongbian" ? "事业编" : category === "gongkao" ? "考公" : "职位";
      const body = [company || label, label].filter(Boolean).join(" · ");
      await pool.query(
        "INSERT INTO job_notifications (user_id, job_id, subscription_id, title, body, url) VALUES ($1, $2, $3, $4, $5, $6)",
        [s.user_id, jobId, s.id, title.slice(0, 120), body.slice(0, 200), r.url || ""]
      );
      count++;
    }
  }
  return count;
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
  const onlyIds = flag("--sources", "").split(",").map((s) => s.trim()).filter(Boolean);
  const PROXY = flag("--proxy", "") || process.env.JOBS_PROXY || "";
  const storageStateFile = resolveStorageState(flag("--storage-state", ""));
  if (storageStateFile) console.log("[info] 复用登录态 Cookie：%s", storageStateFile);
  if (PROXY) console.log("[info] 使用代理：%s", PROXY);

  const started = Date.now();
  const deadline = Date.now() + TIMEOUT_MIN * 60000;
  const runId = DRY ? null : await createRun();
  const sourcesResult = {};
  let allRows = [];
  let allEvents = new Map();
  const errors = [];

  try {
    const sources = await loadSources(onlyIds);
    const active = await activeSources(sources);
    console.log("[info] 官方源：启用 %d 个：%s", active.length, active.map((s) => s.id).join(","));
    if (active.length === 0) {
      console.log("[info] 无启用源，跳过");
      if (runId) await finishRun(runId, "success", {}, 0, 0, null);
      return;
    }

    const httpSources = active.filter((s) => s.engine === "http");
    const browserSources = active.filter((s) => s.engine === "browser");

    for (const src of httpSources) {
      if (Date.now() > deadline) { errors.push(src.id + " 跳过（超时）"); break; }
      try {
        const { rows, eventsByKey } = await crawlHttpSource(src, LIMIT);
        console.log("[ok] http %s -> %d 条", src.id, rows.length);
        allRows.push(...rows);
        for (const [k, v] of eventsByKey) allEvents.set(k, v);
        sourcesResult[src.id] = rows.length;
        await recordHealth(src.id, rows.length, "");
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        errors.push(src.id + ": " + msg);
        sourcesResult[src.id] = 0;
        await recordHealth(src.id, 0, msg);
      }
    }

    if (browserSources.length > 0) {
      if (!chromium) {
        const msg = "未找到 playwright-core";
        for (const src of browserSources) {
          errors.push(src.id + ": " + msg);
          sourcesResult[src.id] = 0;
          await recordHealth(src.id, 0, msg);
        }
      } else {
        const chrome = chromiumPath();
        if (!chrome) {
          const msg = "未找到 Chromium 可执行文件";
          for (const src of browserSources) {
            errors.push(src.id + ": " + msg);
            sourcesResult[src.id] = 0;
            await recordHealth(src.id, 0, msg);
          }
        } else {
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
          for (const src of browserSources) {
            if (Date.now() > deadline) { errors.push(src.id + " 跳过（超时）"); break; }
            const page = await ctx.newPage();
            try {
              const { rows, eventsByKey } = await crawlBrowserSource(page, src, LIMIT);
              console.log("[ok] browser %s -> %d 条", src.id, rows.length);
              allRows.push(...rows);
              for (const [k, v] of eventsByKey) allEvents.set(k, v);
              sourcesResult[src.id] = rows.length;
              await recordHealth(src.id, rows.length, "");
            } catch (e) {
              const msg = e && e.message ? e.message : String(e);
              errors.push(src.id + ": " + msg);
              sourcesResult[src.id] = 0;
              await recordHealth(src.id, 0, msg);
            } finally {
              await page.close().catch(() => {});
            }
          }
          await browser.close().catch(() => {});
        }
      }
    }

    // 归一化 + 去重
    const normalized = allRows.map((r) => ({
      ...r,
      title: String(r.title || "").slice(0, 200),
      company: String(r.company || "").slice(0, 120),
      city: String(r.city || "").slice(0, 40),
      district: String(r.district || "").slice(0, 60),
      salary_text: String(r.salary_text || "").slice(0, 60),
      experience: String(r.experience || "").slice(0, 30),
      education: String(r.education || "").slice(0, 30),
      tags: (r.tags || []).map((x) => String(x).slice(0, 40)).slice(0, 10),
      description: String(r.description || "").slice(0, 5000),
      url: String(r.url || "").slice(0, 500),
      content_hash: contentHash(r),
    }));
    const dedup = new Map();
    for (const p of normalized) dedup.set(p.source + "|" + p.source_job_id, p);
    const rows = [...dedup.values()];

    if (DRY) {
      console.log("[dry-run] 共 %d 行（不写库）", rows.length);
      for (const r of rows.slice(0, 8)) {
        console.log("  -", r.source, r.title.slice(0, 30), "|", r.url.slice(0, 60));
      }
      console.log("[dry-run] 考试事件 %d 个", allEvents.size);
      return;
    }

    const sourcesList = [...new Set(rows.map((r) => r.source))];
    const existing = await existingKeys(sourcesList);
    const newRows = rows.filter((r) => !existing.has(r.source + "|" + r.source_job_id));
    await upsertRows(rows);
    // 清掉市场分析缓存（market_stats 60s TTL，避免爬虫后读到旧数据）
    await pool.query("DELETE FROM market_stats WHERE key = 'full'").catch(() => {});
    const examInserted = await insertExamEvents(rows, allEvents);
    const notifInserted = await matchSubscriptions(newRows);
    console.log("[ok] 写库 %d 行，新增 %d，考试事件 %d，订阅通知 %d",
      rows.length, newRows.length, examInserted, notifInserted);

    const status = errors.length === 0 ? "success" : errors.length >= active.length ? "failed" : "partial";
    if (runId) await finishRun(runId, status, sourcesResult, rows.length, newRows.length, errors.join("; ") || null);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    console.error("[fatal]", msg);
    if (runId) await finishRun(runId, "failed", sourcesResult, 0, 0, msg);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
