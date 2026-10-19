#!/usr/bin/env node
/**
 * 宿主告警检查（S4-5）—— 不引 Prometheus 也能"会叫的告警"。
 *
 * 用法：
 *   node scripts/alert-check.mjs            # 实际检查
 *   node scripts/alert-check.mjs --dry-run  # 只打印"将要检查什么"（不发请求、不连库、退出码 0）
 *   node scripts/alert-check.mjs --verbose  # 额外打印每条检查的明细
 *
 * 四条规则（阈值与依据见 docs/运维告警规则.md）：
 *   1. disk     宿主根分区可用空间 < ALERT_DISK_MIN_GIB（默认 10 GiB）→ WARN（容器内/非 Linux 自动跳过）
 *   2. pg_pool  lwb_pg_pool_usage_ratio > ALERT_PG_POOL_MAX_RATIO（默认 0.8）→ WARN（连接池将耗尽）
 *   3. http_5xx 5xx / 全部请求 > ALERT_5XX_MAX_RATIO（默认 5%，样本 >= ALERT_5XX_MIN_REQUESTS）→ WARN；
 *               /metrics 里没有 HTTP 请求计数（尚未埋点/进程刚重启）→ SKIP 并说明
 *   4. cron     当日 04:30 抓取任务是否 success（查 job_crawler_runs，宽限到 ALERT_CRON_GRACE_HOUR，默认 6 点）
 *
 * 触发：
 *   - 设置 ALERT_WEBHOOK_URL → POST 一段 JSON（失败退出 1）；
 *   - 未设置 → 把 WARN 打到 stderr 并 exit 1（配合 crontab 的 MAILTO 收信）。
 * 退出码：0 = 全部正常（或告警已成功投递）；1 = 有告警（无 webhook / webhook 失败）；2 = 配置或用例错误。
 *
 * 环境变量：见 CONFIG；另外 ALERT_METRICS_FILE 可指向一份 Prometheus 文本文件（离线演练/自测用，
 * 优先级高于 ALERT_METRICS_URL）；ALERT_DB_CHECK=off 可只做 HTTP 侧检查。
 *
 * 注意：lib/metrics 的计数器是**进程内**的（重启清零、无历史），所以 5xx 比例是
 * "自进程启动以来"的近似值；需要历史趋势时应接 Prometheus/VictoriaMetrics。
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ARGV = new Set(process.argv.slice(2));
const DRY_RUN = ARGV.has("--dry-run");
const VERBOSE = ARGV.has("--verbose");

const GIB = 1024 ** 3;

function envNum(name, fallback) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const CONFIG = {
  metricsUrl: (process.env.ALERT_METRICS_URL || "http://127.0.0.1:3001/api/internal/metrics").trim(),
  metricsFile: (process.env.ALERT_METRICS_FILE || "").trim(),
  secret: (process.env.CRON_SECRET || "").trim(),
  webhookUrl: (process.env.ALERT_WEBHOOK_URL || "").trim(),
  timeoutMs: envNum("ALERT_HTTP_TIMEOUT_MS", 5000),
  diskPath: (process.env.ALERT_DISK_PATH || "/").trim(),
  diskMinGiB: envNum("ALERT_DISK_MIN_GIB", 10),
  poolMaxRatio: envNum("ALERT_PG_POOL_MAX_RATIO", 0.8),
  poolMaxConnections: envNum("PGPOOL_MAX", 20),
  http5xxMaxRatio: envNum("ALERT_5XX_MAX_RATIO", 0.05),
  http5xxMinRequests: envNum("ALERT_5XX_MIN_REQUESTS", 50),
  cronGraceHour: envNum("ALERT_CRON_GRACE_HOUR", 6),
  dbCheck: (process.env.ALERT_DB_CHECK || "auto").trim(),
  dbTimeoutMs: envNum("ALERT_DB_TIMEOUT_MS", 3000),
};

function nowIso() {
  return new Date().toISOString();
}

function fmt(value, digits) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return Number(value).toFixed(digits === undefined ? 2 : digits);
}

/* ------------------------------------------------------------------ *
 * Prometheus 文本解析（只取 name{labels} value / name value，忽略注释）
 * ------------------------------------------------------------------ */
export function parsePrometheus(text) {
  const series = [];
  const lines = String(text || "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9.eE+]+|-?Inf|NaN)$/.exec(line);
    if (!m) continue;
    const labels = {};
    if (m[2]) {
      const body = m[2].slice(1, -1);
      const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
      let lm;
      while ((lm = re.exec(body)) !== null) {
        labels[lm[1]] = lm[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }
    const value = Number(m[3]);
    if (!Number.isFinite(value)) continue;
    series.push({ name: m[1], labels: labels, value: value });
  }
  return series;
}

export function findGauge(series, name) {
  for (const s of series) {
    if (s.name === name) return s.value;
  }
  return null;
}

function statusClassOf(labels) {
  const raw = String(labels.status || labels.status_class || labels.status_code || labels.code || "");
  if (!raw) return null;
  if (raw === "5xx") return 5;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 100 && n < 600) return Math.floor(n / 100);
  return null;
}

/* ------------------------------------------------------------------ *
 * 检查 1：磁盘可用空间（仅 Linux 宿主；容器内交给宿主）
 * ------------------------------------------------------------------ */
function inContainer() {
  try {
    if (fs.existsSync("/.dockerenv") || fs.existsSync("/run/.containerenv")) return true;
    const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
    return /docker|kubepods|containerd|lxc/.test(cgroup);
  } catch {
    return false;
  }
}

export function checkDisk() {
  if (process.platform !== "linux") {
    return { rule: "disk", status: "skip", summary: "非 Linux 宿主（" + process.platform + "），跳过磁盘检查" };
  }
  if (inContainer() && process.env.ALERT_DISK_FORCE !== "1") {
    return { rule: "disk", status: "skip", summary: "检测到容器环境，磁盘由宿主 cron 检查（ALERT_DISK_FORCE=1 可强制）" };
  }
  try {
    const st = fs.statfsSync(CONFIG.diskPath);
    const availBytes = Number(st.bavail) * Number(st.bsize);
    const availGiB = availBytes / GIB;
    const ok = availGiB >= CONFIG.diskMinGiB;
    return {
      rule: "disk",
      status: ok ? "ok" : "warn",
      value: availGiB,
      threshold: CONFIG.diskMinGiB,
      summary: CONFIG.diskPath + " 可用 " + fmt(availGiB, 1) + " GiB（阈值 " + fmt(CONFIG.diskMinGiB, 0) + " GiB）",
      message: ok ? null : "磁盘可用空间不足：" + fmt(availGiB, 1) + " GiB < " + fmt(CONFIG.diskMinGiB, 0) + " GiB（" + CONFIG.diskPath + "）",
    };
  } catch (e) {
    return { rule: "disk", status: "skip", summary: "statfs 失败，跳过：" + String(e && e.message ? e.message : e) };
  }
}

/* ------------------------------------------------------------------ *
 * 检查 2：PG 连接池占用（指标来自 /api/internal/metrics）
 * ------------------------------------------------------------------ */
export function checkPool(series) {
  const usageGauge = findGauge(series, "lwb_pg_pool_usage_ratio");
  const total = findGauge(series, "lwb_pg_pool_total_connections");
  const waiting = findGauge(series, "lwb_pg_pool_waiting_requests");
  const max = findGauge(series, "lwb_pg_pool_max_connections") || CONFIG.poolMaxConnections;
  const usage = usageGauge !== null ? usageGauge : total !== null && max ? total / max : null;
  if (usage === null) {
    return { rule: "pg_pool", status: "skip", summary: "metrics 缺少 lwb_pg_pool_usage_ratio（旧版本 /metrics 或连接池未初始化）" };
  }
  const bad = usage > CONFIG.poolMaxRatio;
  const detail = "连接 " + fmt(total, 0) + "/" + fmt(max, 0) + "（" + fmt(usage * 100, 1) + "%），等待 " + fmt(waiting, 0);
  return {
    rule: "pg_pool",
    status: bad ? "warn" : "ok",
    value: usage,
    threshold: CONFIG.poolMaxRatio,
    summary: detail + "（阈值 " + fmt(CONFIG.poolMaxRatio * 100, 0) + "%）",
    message: bad
      ? "PG 连接池占用过高：" + fmt(usage * 100, 1) + "% > " + fmt(CONFIG.poolMaxRatio * 100, 0) + "%（" + detail + "）"
      : null,
  };
}

/* ------------------------------------------------------------------ *
 * 检查 3：5xx 比例（来自 /metrics 的 HTTP 请求计数器；无埋点则跳过）
 * ------------------------------------------------------------------ */
export function check5xx(series) {
  const names = ["lwb_http_requests_total", "lwb_http_request_total", "lwb_http_requests"];
  const counters = series.filter((s) => names.includes(s.name));
  if (counters.length === 0) {
    return {
      rule: "http_5xx",
      status: "skip",
      summary: "metrics 里没有 HTTP 请求计数（withRoute 尚未埋点或进程刚重启），5xx 比例无数据，跳过",
    };
  }
  let total = 0;
  let bad = 0;
  for (const s of counters) {
    total += s.value;
    if (statusClassOf(s.labels) === 5) bad += s.value;
  }
  if (total < CONFIG.http5xxMinRequests) {
    return {
      rule: "http_5xx",
      status: "skip",
      summary: "请求样本不足（" + total + " < " + CONFIG.http5xxMinRequests + "），不判定 5xx 比例",
    };
  }
  const ratio = bad / total;
  const isBad = ratio > CONFIG.http5xxMaxRatio;
  return {
    rule: "http_5xx",
    status: isBad ? "warn" : "ok",
    value: ratio,
    threshold: CONFIG.http5xxMaxRatio,
    summary: "5xx " + bad + "/" + total + "（" + fmt(ratio * 100, 2) + "%，阈值 " + fmt(CONFIG.http5xxMaxRatio * 100, 0) + "%）",
    message: isBad
      ? "5xx 比例过高：" + fmt(ratio * 100, 2) + "% > " + fmt(CONFIG.http5xxMaxRatio * 100, 0) + "%（" + bad + "/" + total + "，自进程启动以来）"
      : null,
  };
}

/* ------------------------------------------------------------------ *
 * 检查 4：当日抓取 cron 是否成功（直连 PG；docker 部署 DB 未暴露端口时跳过）
 * ------------------------------------------------------------------ */
async function checkCron() {
  if (CONFIG.dbCheck === "off") {
    return { rule: "cron", status: "skip", summary: "ALERT_DB_CHECK=off，跳过 cron 检查" };
  }
  let pg;
  try {
    pg = require("pg");
  } catch {
    return { rule: "cron", status: "skip", summary: "宿主缺少 pg 模块（node_modules 未安装？），跳过 cron 检查" };
  }
  const pool = new pg.Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: envNum("PGPORT", 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "Learn-Workbench",
    max: 1,
    connectionTimeoutMillis: CONFIG.dbTimeoutMs,
    idleTimeoutMillis: 1000,
  });
  try {
    const res = await pool.query(
      "SELECT max(started_at)::text AS last_success, COALESCE(max(started_at) >= date_trunc('day', now()), false) AS today_ok FROM job_crawler_runs WHERE status = 'success'"
    );
    const row = (res.rows && res.rows[0]) || {};
    const todayOk = row.today_ok === true || row.today_ok === "t";
    const hour = new Date().getHours();
    if (todayOk) {
      return { rule: "cron", status: "ok", summary: "当日抓取已成功（最近成功：" + (row.last_success || "?") + "）" };
    }
    if (hour < CONFIG.cronGraceHour && CONFIG.cronGraceHour > 0) {
      return {
        rule: "cron",
        status: "skip",
        summary: "当日尚未抓到成功记录，但未到宽限时间（" + CONFIG.cronGraceHour + ":00 前不告警；最近成功：" + (row.last_success || "无") + "）",
      };
    }
    return {
      rule: "cron",
      status: "warn",
      summary: "当日抓取未成功（最近成功：" + (row.last_success || "无") + "）",
      message: "当日 04:30 招聘抓取任务没有 success 记录（最近成功：" + (row.last_success || "无") + "），检查 crontab / x-cron-secret / 爬虫日志",
    };
  } catch (e) {
    const code = e && e.code ? String(e.code) : "";
    const msg = String(e && e.message ? e.message : e);
    if (code === "42P01") {
      return { rule: "cron", status: "skip", summary: "job_crawler_runs 不存在（迁移未应用/新库），跳过 cron 检查" };
    }
    if (CONFIG.dbCheck === "on") {
      return { rule: "cron", status: "warn", summary: "DB 检查失败：" + msg, message: "ALERT_DB_CHECK=on 但数据库不可用：" + msg };
    }
    return {
      rule: "cron",
      status: "skip",
      summary: "数据库不可直连（docker 部署 DB 未暴露端口属正常）：" + msg + "；可设 ALERT_DB_CHECK=on 强制告警",
    };
  } finally {
    try {
      await pool.end();
    } catch {
      // 忽略
    }
  }
}

/* ------------------------------------------------------------------ *
 * 指标抓取
 * ------------------------------------------------------------------ */
async function loadMetrics() {
  if (CONFIG.metricsFile) {
    try {
      return { ok: true, text: fs.readFileSync(CONFIG.metricsFile, "utf8"), source: "file:" + CONFIG.metricsFile };
    } catch (e) {
      return { ok: false, error: "读取 ALERT_METRICS_FILE 失败：" + String(e && e.message ? e.message : e) };
    }
  }
  if (!CONFIG.secret) {
    return { ok: false, error: "CRON_SECRET 未设置，无法访问内部 /metrics（ALERT_METRICS_FILE 可离线演练）" };
  }
  try {
    const res = await fetch(CONFIG.metricsUrl, {
      headers: { "x-cron-secret": CONFIG.secret },
      signal: AbortSignal.timeout(CONFIG.timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: "GET /metrics 失败：HTTP " + res.status + " " + text.slice(0, 120) };
    }
    return { ok: true, text: text, source: CONFIG.metricsUrl };
  } catch (e) {
    const msg = e && e.name === "TimeoutError" ? "超时（" + CONFIG.timeoutMs + "ms）" : String(e && e.message ? e.message : e);
    return { ok: false, error: "GET /metrics 失败：" + msg };
  }
}

/* ------------------------------------------------------------------ *
 * 输出与投递
 * ------------------------------------------------------------------ */
function label(status) {
  if (status === "ok") return "[OK]  ";
  if (status === "warn") return "[WARN]";
  return "[SKIP]";
}

function printChecks(checks) {
  for (const c of checks) {
    console.log(label(c.status) + " " + c.rule.padEnd(8) + " " + c.summary);
    if (VERBOSE && c.message) console.log("        → " + c.message);
  }
}

function printPlan(metricsNote) {
  console.log("[alert-check] --dry-run（不请求网络、不连库）  时间 " + nowIso());
  console.log("  指标来源      : " + (CONFIG.metricsFile ? "file:" + CONFIG.metricsFile : CONFIG.metricsUrl) + (CONFIG.secret ? "（CRON_SECRET 已设置）" : "（CRON_SECRET 未设置，实际运行会 WARN）"));
  console.log("  webhook       : " + (CONFIG.webhookUrl ? "已配置（告警将 POST JSON）" : "未配置（告警走 stderr + exit 1，建议 crontab MAILTO）"));
  console.log("  规则 1 disk   : " + CONFIG.diskPath + " 可用 < " + fmt(CONFIG.diskMinGiB, 0) + " GiB  → WARN（平台 " + process.platform + (process.platform === "linux" && inContainer() ? "，容器内将跳过" : "") + "）");
  console.log("  规则 2 pg_pool: lwb_pg_pool_usage_ratio > " + fmt(CONFIG.poolMaxRatio * 100, 0) + "% → WARN（PGPOOL_MAX 默认 " + CONFIG.poolMaxConnections + "）");
  console.log("  规则 3 http5xx: 5xx/全部 > " + fmt(CONFIG.http5xxMaxRatio * 100, 0) + "% 且样本 >= " + CONFIG.http5xxMinRequests + " → WARN（无计数指标则 SKIP）");
  console.log("  规则 4 cron   : 当日 job_crawler_runs 无 success → WARN（宽限到 " + CONFIG.cronGraceHour + ":00；ALERT_DB_CHECK=" + CONFIG.dbCheck + "）");
  if (metricsNote) console.log("  离线指标文件  : " + metricsNote);
  console.log("  将执行        : 上述 4 条；有 WARN 时 " + (CONFIG.webhookUrl ? "POST webhook（失败 exit 1）" : "stderr + exit 1"));
}

async function deliver(payload) {
  if (!CONFIG.webhookUrl) return { delivered: false, error: "ALERT_WEBHOOK_URL 未配置" };
  try {
    const res = await fetch(CONFIG.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CONFIG.timeoutMs),
    });
    if (!res.ok) return { delivered: false, error: "webhook HTTP " + res.status };
    return { delivered: true };
  } catch (e) {
    return { delivered: false, error: String(e && e.message ? e.message : e) };
  }
}

async function main() {
  if (DRY_RUN) {
    let note = "";
    if (CONFIG.metricsFile) {
      try {
        const series = parsePrometheus(fs.readFileSync(CONFIG.metricsFile, "utf8"));
        note = CONFIG.metricsFile + " 可解析 " + series.length + " 条序列";
      } catch (e) {
        note = CONFIG.metricsFile + " 读取失败：" + String(e && e.message ? e.message : e);
      }
    }
    printPlan(note);
    return;
  }

  const checks = [];
  const metrics = await loadMetrics();
  if (!metrics.ok) {
    checks.push({
      rule: "metrics",
      status: "warn",
      summary: "指标端点不可用：" + metrics.error,
      message: "监控盲区：/api/internal/metrics 不可达（服务没起 / CRON_SECRET 不对 / 端口不对）",
    });
  }

  checks.push(checkDisk());
  if (metrics.ok) {
    const series = parsePrometheus(metrics.text);
    checks.push(checkPool(series));
    checks.push(check5xx(series));
  } else {
    checks.push({ rule: "pg_pool", status: "skip", summary: "指标端点不可用，跳过连接池检查" });
    checks.push({ rule: "http_5xx", status: "skip", summary: "指标端点不可用，跳过 5xx 检查" });
  }
  checks.push(await checkCron());

  console.log("[alert-check] " + nowIso() + "  source=" + (metrics.ok ? metrics.source : "unavailable"));
  printChecks(checks);
  const alerts = checks.filter((c) => c.status === "warn");
  console.log("结果：" + (alerts.length === 0 ? "OK" : "WARN(" + alerts.length + ")") + "，检查 " + checks.length + " 项");

  const payload = {
    source: "learn-workbench/alert-check",
    checkedAt: nowIso(),
    status: alerts.length === 0 ? "ok" : "warn",
    host: process.env.HOSTNAME || "",
    alerts: alerts.map((c) => ({ rule: c.rule, message: c.message || c.summary, value: c.value === undefined ? null : c.value, threshold: c.threshold === undefined ? null : c.threshold })),
    checks: checks.map((c) => ({ rule: c.rule, status: c.status, summary: c.summary })),
  };

  if (alerts.length > 0) {
    const result = await deliver(payload);
    if (result.delivered) {
      console.log("[alert-check] 已通过 webhook 投递 " + alerts.length + " 条告警");
      return;
    }
    if (CONFIG.webhookUrl) {
      console.error("[alert-check] 告警已触发，但 webhook 投递失败：" + result.error);
    }
    for (const c of alerts) console.error("[alert-check] WARN [" + c.rule + "] " + (c.message || c.summary));
    console.error("[alert-check] 未成功投递（" + (CONFIG.webhookUrl ? "webhook 失败" : "未配置 ALERT_WEBHOOK_URL") + "），按 cron MAILTO 约定 exit 1");
    process.exitCode = 1;
  }
}

// 只有直接执行时才跑 main（被 import 时只暴露纯函数，便于复用/自测）
const IS_MAIN = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (IS_MAIN) {
  main().catch((e) => {
    console.error("[alert-check] 执行失败：" + String(e && e.stack ? e.stack : e));
    process.exitCode = 2;
  });
}
