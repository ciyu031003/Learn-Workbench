/**
 * alert 演练（S7-2）：用 scripts/alert-check.mjs 的**离线指标样本**跑四条路径：
 *   1) --dry-run 计划输出；
 *   2) WARN 样本 + 无 webhook → exit 1（stderr 有 [WARN]）；
 *   3) OK 样本 → exit 0；
 *   4) WARN 样本 + 本地临时 webhook 服务 → exit 0 且收到 JSON（status=warn，alerts 含 pg_pool/http_5xx）。
 *
 * 不依赖真实 /metrics / 数据库 / 外网：ALERT_METRICS_FILE + ALERT_DB_CHECK=off + ALERT_DISK_MIN_GIB=0。
 */
import http from "node:http";
import path from "node:path";
import * as L from "./lib.mjs";

const ALERT_SCRIPT = "scripts/alert-check.mjs";

const WARN_METRICS = [
  "lwb_pg_pool_usage_ratio 0.85",
  "lwb_pg_pool_total_connections 17",
  "lwb_pg_pool_idle_connections 3",
  "lwb_pg_pool_waiting_requests 2",
  "lwb_pg_pool_max_connections 20",
  'lwb_http_requests_total{status="200"} 940',
  'lwb_http_requests_total{status="500"} 60',
  "",
].join("\n");

const OK_METRICS = [
  "lwb_pg_pool_usage_ratio 0.25",
  "lwb_pg_pool_total_connections 5",
  "lwb_pg_pool_idle_connections 3",
  "lwb_pg_pool_max_connections 20",
  "lwb_process_uptime_seconds 1234",
  "",
].join("\n");

function runAlert(metricsFile, extraEnv = {}, args = []) {
  const env = {
    ALERT_METRICS_FILE: metricsFile,
    ALERT_DB_CHECK: "off",
    ALERT_DISK_MIN_GIB: "0",
    ALERT_WEBHOOK_URL: "",
    ...extraEnv,
  };
  // 继承环境里可能存在的真实 URL/secret：显式清空，保证离线确定性
  env.ALERT_METRICS_URL = "";
  env.CRON_SECRET = "";
  return L.runNode(ALERT_SCRIPT, args, env, { timeoutMs: 60000 });
}

async function runAlertAsync(metricsFile, extraEnv = {}, args = []) {
  const env = {
    ALERT_METRICS_FILE: metricsFile,
    ALERT_DB_CHECK: "off",
    ALERT_DISK_MIN_GIB: "0",
    ALERT_WEBHOOK_URL: "",
    ...extraEnv,
  };
  env.ALERT_METRICS_URL = "";
  env.CRON_SECRET = "";
  return L.runNodeAsync(ALERT_SCRIPT, args, env, { timeoutMs: 60000 });
}

function startWebhook() {
  return new Promise((resolve, reject) => {
    const received = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        received.push({ method: req.method, url: req.url, body });
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{\"ok\":true}");
      });
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, received, url: "http://127.0.0.1:" + port + "/hook" });
    });
  });
}

export async function run(ctx) {
  const checks = L.createChecks();
  const scriptPath = path.join(L.ROOT, ALERT_SCRIPT);
  if (!L.readText(scriptPath)) {
    return L.result("alert", "FAIL", { reason: "缺少 " + ALERT_SCRIPT, checks: checks.checks });
  }
  checks.add(ALERT_SCRIPT + " 存在", true, ALERT_SCRIPT);

  const dir = L.makeTempDir("lwb-drill-alert-");
  let webhook = null;
  try {
    const warnFile = L.writeFile(dir, "warn.prom", WARN_METRICS);
    const okFile = L.writeFile(dir, "ok.prom", OK_METRICS);

    // 1) --dry-run：不发请求、exit 0
    const dry = runAlert(warnFile, {}, ["--dry-run"]);
    checks.add("alert-check --dry-run exit 0", dry.status === 0, "exit=" + dry.status + " " + L.tail(dry.stderr, 160));
    checks.add("--dry-run 输出四条规则计划", /规则 2 pg_pool/.test(dry.stdout) && /规则 4 cron/.test(dry.stdout), "");

    // 2) WARN 样本 + 无 webhook → exit 1 + stderr WARN
    const warn = runAlert(warnFile);
    checks.add("WARN 样本 → exit 1", warn.status === 1, "exit=" + warn.status + " " + L.tail(warn.stderr, 160));
    checks.add("WARN 样本输出 [WARN] 行", /\[WARN\]\s+pg_pool/.test(warn.stderr + warn.stdout), "");
    checks.add("WARN 样本结果行 WARN(2)", /结果：WARN\(2\)/.test(warn.stdout), "");

    // 3) OK 样本 → exit 0
    const ok = runAlert(okFile);
    checks.add("OK 样本 → exit 0", ok.status === 0, "exit=" + ok.status + " " + L.tail(ok.stderr, 160));
    checks.add("OK 样本结果行 OK", /结果：OK/.test(ok.stdout), "");

    // 4) WARN + webhook：投递成功 → exit 0
    webhook = await startWebhook();
    const hooked = await runAlertAsync(warnFile, { ALERT_WEBHOOK_URL: webhook.url });
    checks.add("WARN + webhook → exit 0（已投递）", hooked.status === 0, "exit=" + hooked.status + " url=" + webhook.url + " " + L.tail(hooked.stderr, 800));
    checks.add("webhook 恰好收到 1 个 POST", webhook.received.length === 1 && webhook.received[0].method === "POST", "received=" + webhook.received.length);
    let payload = null;
    try {
      payload = webhook.received[0] ? JSON.parse(webhook.received[0].body) : null;
    } catch {
      payload = null;
    }
    checks.add("webhook JSON 可解析且 status=warn", !!payload && payload.status === "warn", payload ? "status=" + payload.status : "invalid json");
    const rules = payload && Array.isArray(payload.alerts) ? payload.alerts.map((a) => a.rule) : [];
    checks.add("webhook alerts 含 pg_pool/http_5xx", rules.includes("pg_pool") && rules.includes("http_5xx"), rules.join(","));

    return L.result("alert", checks.allOk() ? "PASS" : "FAIL", {
      reason: checks.allOk() ? "dry-run / WARN / OK / webhook 四条路径全部通过" : "存在未通过检查项：" + checks.failed().map((c) => c.name).join("；"),
      checks: checks.checks,
    });
  } finally {
    if (webhook) await new Promise((resolve) => webhook.server.close(resolve));
    L.cleanupDir(dir);
  }
}
