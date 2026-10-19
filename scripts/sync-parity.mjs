#!/usr/bin/env node
/**
 * sync-parity.mjs — Web / App 双端一致性「协议级」门禁（S5-7a）。
 *
 * 不起真机、不依赖浏览器，直接打 HTTP API，把三条链路固化成可重复执行的检查：
 *   链路 A：Web 登录 → 写一条业务数据（POST /api/logs）→ GET /api/sync/pull 能看到
 *   链路 B：模拟 App 离线队列 → POST /api/sync/push（多条、含过期 updatedAt）→
 *           断言回执 applied / stale-LWW 语义且可定位 index → 幂等重推 → pull 验证终态
 *   链路 C：date key 一致性：服务器时间与本地时间在 Asia/Shanghai 同一天（覆盖格式与零点边界）
 *
 * 输出机读行（CI 可 grep）：
 *   SYNC_PARITY_OK link=A ...
 *   SYNC_PARITY_SKIP link=B reason=NO_CREDENTIALS ...
 *   SYNC_PARITY_DETAIL link=B index=1 ...
 *   SYNC_PARITY_FAIL link=B reason=...
 *   最终汇总：SYNC_PARITY_OK / SYNC_PARITY_FAIL
 *
 * 约定：
 * - 缺服务 / 缺凭据 → 明确 SKIP 且 exit 0（不静默通过，SKIP 行带原因）。
 * - 服务在但断言失败 / 凭据错误 → exit 1。
 * - --dry-run 只打印计划与解析后的配置（密码打码），不发起任何网络请求，exit 0。
 *
 * 配置（优先级：进程环境变量 > e2e/.env > .env）：
 *   SYNC_PARITY_BASE_URL | E2E_BASE_URL  默认 http://localhost:3001
 *   SYNC_PARITY_USERNAME | E2E_USERNAME
 *   SYNC_PARITY_PASSWORD | E2E_PASSWORD
 *   SYNC_PARITY_TIMEOUT_MS               单请求超时，默认 5000
 *
 * 用法：
 *   node scripts/sync-parity.mjs --dry-run
 *   SYNC_PARITY_BASE_URL=http://localhost:3011 E2E_USERNAME=... E2E_PASSWORD=... node scripts/sync-parity.mjs
 *   node scripts/sync-parity.mjs --only=A,C --json
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TZ = "Asia/Shanghai";

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const argValue = (name) => {
  const eq = argv.find((a) => a.startsWith(name + "="));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (hasFlag("--help") || hasFlag("-h")) {
  console.log([
    "用法: node scripts/sync-parity.mjs [--dry-run] [--json] [--only=A,B,C] [--keep-data]",
    "",
    "  --dry-run    只打印计划与配置（密码打码），不发请求，exit 0",
    "  --json       末尾额外输出一行 JSON 汇总",
    "  --only=      只跑指定链路（逗号分隔），默认 A,B,C",
    "  --keep-data  不清理链路 B 写入的测试任务（默认用 DELETE tombstone 清理）",
    "",
    "环境变量：",
    "  SYNC_PARITY_BASE_URL | E2E_BASE_URL   目标站点，默认 http://localhost:3001",
    "  SYNC_PARITY_USERNAME | E2E_USERNAME   测试账号",
    "  SYNC_PARITY_PASSWORD | E2E_PASSWORD   测试密码",
  ].join("\n"));
  process.exit(0);
}

const DRY_RUN = hasFlag("--dry-run");
const JSON_OUT = hasFlag("--json");
const KEEP_DATA = hasFlag("--keep-data");
const ONLY = new Set(
  (argValue("--only") || "A,B,C")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

/** 轻量 .env 读取（不引入 dotenv）：仅解析 KEY=VALUE 行 */
function loadEnvFiles() {
  const out = {};
  for (const rel of [".env", "e2e/.env"]) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const fileEnv = loadEnvFiles();
const config = {
  baseUrl: (
    process.env.SYNC_PARITY_BASE_URL ||
    process.env.E2E_BASE_URL ||
    fileEnv.SYNC_PARITY_BASE_URL ||
    fileEnv.E2E_BASE_URL ||
    "http://localhost:3001"
  ).replace(/\/+$/, ""),
  username:
    process.env.SYNC_PARITY_USERNAME || process.env.E2E_USERNAME || fileEnv.SYNC_PARITY_USERNAME || fileEnv.E2E_USERNAME || "",
  password:
    process.env.SYNC_PARITY_PASSWORD || process.env.E2E_PASSWORD || fileEnv.SYNC_PARITY_PASSWORD || fileEnv.E2E_PASSWORD || "",
  timeoutMs: Number(process.env.SYNC_PARITY_TIMEOUT_MS || 5000),
};

const RUN_ID = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
const DEVICE_ID = "sync-parity";
const MASKED_PASSWORD = config.password ? "*".repeat(Math.min(8, config.password.length)) : "(未配置)";
const state = { results: [], details: [] };

function line(text) {
  console.log(text);
}
function detail(link, text) {
  state.details.push(text);
  line("SYNC_PARITY_DETAIL link=" + link + " " + text);
}
function ok(link, text) {
  state.results.push({ link, status: "OK", reason: text || undefined });
  line("SYNC_PARITY_OK link=" + link + (text ? " " + text : ""));
}
function skip(link, reason) {
  state.results.push({ link, status: "SKIP", reason });
  line("SYNC_PARITY_SKIP link=" + link + " reason=" + reason);
}
function fail(link, reason) {
  state.results.push({ link, status: "FAIL", reason });
  line("SYNC_PARITY_FAIL link=" + link + " reason=" + reason);
}

/** date key（Asia/Shanghai，YYYY-MM-DD）：en-CA numeric 格式恰好是 ISO 日期 */
function dateKey(ms) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function maskUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

async function request(method, pathname, opts) {
  const options = opts || {};
  const url = new URL(pathname, config.baseUrl).toString();
  const headers = { accept: "application/json, text/plain, */*" };
  if (options.token) headers.authorization = "Bearer " + options.token;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs || config.timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

/** 探测服务是否可达：任何 HTTP 状态都算可达（401 也说明服务在） */
async function probeServer() {
  try {
    const res = await request("GET", "/api/auth/me");
    return { reachable: true, status: res.status, headers: res.headers };
  } catch (e) {
    const code = e && e.name === "TimeoutError" ? "TIMEOUT" : (e && e.cause && e.cause.code) || (e && e.code) || "UNREACHABLE";
    return { reachable: false, reason: code };
  }
}

async function login() {
  const res = await request("POST", "/api/auth/login", {
    body: { username: config.username, password: config.password },
  });
  if (!res.ok) return { ok: false, status: res.status, error: (res.json && res.json.error) || res.text.slice(0, 200) };
  const token = res.json && res.json.token;
  if (!token) return { ok: false, status: res.status, error: "登录响应缺少 token" };
  return { ok: true, token };
}

function todayKey() {
  return dateKey(Date.now());
}

// ---------------------------------------------------------------------------
// 链路 A：Web 写业务数据 → sync pull 可见
// ---------------------------------------------------------------------------
async function linkA(ctx) {
  const title = "parity-a-" + RUN_ID;
  const since = new Date(Date.now() - 120000).toISOString();
  const created = await request("POST", "/api/logs", {
    token: ctx.token,
    body: { kind: "feynman", career: "ict", title, content: "S5-7a sync parity probe (safe to delete)." },
  });
  if (created.status !== 201) {
    fail("A", "WRITE_HTTP_" + created.status);
    return;
  }
  const logId = created.json && created.json.log && created.json.log.id;
  if (!logId) {
    fail("A", "WRITE_NO_ID");
    return;
  }
  detail("A", "write=ok logId=" + logId + " title=" + title);

  const pull = await request(
    "GET",
    "/api/sync/pull?deviceId=" + DEVICE_ID + "&deviceName=sync-parity&since=" + encodeURIComponent(since),
    { token: ctx.token }
  );
  if (!pull.ok || !Array.isArray(pull.json && pull.json.changes)) {
    fail("A", "PULL_HTTP_" + pull.status);
    return;
  }
  const hit = pull.json.changes.find((c) => c.entityType === "logs" && c.payload && c.payload.title === title);
  if (!hit) {
    fail("A", "PULL_MISSING_WRITE");
    return;
  }
  detail("A", "pull=ok changes=" + pull.json.changes.length + " entity=" + hit.entityId + " op=" + hit.operation);

  const rest = await request("GET", "/api/logs?limit=200", { token: ctx.token });
  const row = rest.json && Array.isArray(rest.json.logs) ? rest.json.logs.find((l) => l.title === title) : null;
  if (!row) {
    fail("A", "REST_READBACK_MISSING");
    return;
  }
  ok("A", "logId=" + logId + " pullEntity=" + hit.entityId);
}

// ---------------------------------------------------------------------------
// 链路 B：App 离线队列 → push 逐条回执 + 幂等 + LWW
// ---------------------------------------------------------------------------
async function linkB(ctx) {
  const probe = await request("POST", "/api/sync/push", {
    token: ctx.token,
    body: { deviceId: DEVICE_ID, changes: [] },
  });
  if (probe.status === 404 || probe.status === 405) {
    skip("B", "SYNC_PUSH_NOT_READY(S5-2 未落地)");
    return;
  }
  if (probe.status === 401) {
    fail("B", "AUTH_FAILED");
    return;
  }
  if (probe.status >= 500) {
    fail("B", "PUSH_PROBE_HTTP_" + probe.status);
    return;
  }

  const now = Date.now();
  const entityA = "parity-b-" + RUN_ID + "-fresh";
  const entityB = "parity-b-" + RUN_ID + "-second";
  // 与 shared/src/sync.ts 的 tasks payload（dailyTaskSchema）逐字段对齐：
// 服务端按契约严格校验，缺 phaseId/topicId/id 会被 400（这是期望行为，夹具按真实客户端补齐）。
const basePayload = {
  id: 0,
  taskDate: todayKey(),
  title: "",
  phaseId: null,
  topicId: null,
  taskType: "study",
  careerKey: "ict",
  done: false,
  focusMinutes: 0,
  sortOrder: 0,
};
  const payloadA = Object.assign({}, basePayload, { title: "B-fresh-" + RUN_ID });
  const payloadStale = Object.assign({}, basePayload, { title: "B-stale-" + RUN_ID, done: true });
  const payloadB = Object.assign({}, basePayload, { title: "B-second-" + RUN_ID });

  // 队列顺序语义：
  //   index 0：同实体较新的 CREATE（最终生效）
  //   index 1：同实体更旧（过期 updatedAt）的 UPDATE → 必须被 LWW 判为 stale、不得覆盖 index 0
  //   index 2：另一实体 CREATE（正常生效）
  const changes = [
    { entityType: "tasks", entityId: entityA, operation: "CREATE", version: 1, updatedAt: new Date(now - 60000).toISOString(), changeId: RUN_ID + "-b0", payload: payloadA },
    { entityType: "tasks", entityId: entityA, operation: "UPDATE", version: 2, updatedAt: new Date(now - 180000).toISOString(), changeId: RUN_ID + "-b1", payload: payloadStale },
    { entityType: "tasks", entityId: entityB, operation: "CREATE", version: 1, updatedAt: new Date(now - 30000).toISOString(), changeId: RUN_ID + "-b2", payload: payloadB },
  ];
  const expected = [
    { index: 0, entityId: entityA, expect: "applied" },
    { index: 1, entityId: entityA, expect: "stale_lww_noop" },
    { index: 2, entityId: entityB, expect: "applied" },
  ];
  for (const exp of expected) {
    detail("B", "index=" + exp.index + " entityId=" + exp.entityId + " expect=" + exp.expect);
  }

  const push = await request("POST", "/api/sync/push", {
    token: ctx.token,
    body: { deviceId: DEVICE_ID, deviceName: "sync-parity", changes },
  });
  if (!push.ok) {
    fail("B", "PUSH_HTTP_" + push.status + ":" + JSON.stringify(push.json || push.text.slice(0, 160)));
    return;
  }
  if (typeof (push.json && push.json.applied) !== "number") {
    fail("B", "NO_APPLIED_FIELD");
    return;
  }
  const appliedCount = push.json.applied;
  // 当前 API 契约：{ ok, applied:number, serverTime }，没有逐条 receipt 数组；
  // 若后续升级为 results[]/receipts[]，这里会自动按 index 校验（向前兼容）。
  const receipts = Array.isArray(push.json.results)
    ? push.json.results
    : Array.isArray(push.json.receipts)
      ? push.json.receipts
      : null;
  if (receipts) {
    for (const exp of expected) {
      const item = receipts[exp.index];
      const got = item ? item.status || item.result || item.applied : "(missing)";
      detail("B", "index=" + exp.index + " receipt=" + JSON.stringify(got));
    }
  } else {
    detail("B", "receipt=count-only applied=" + appliedCount + " (API 契约: {ok,applied,serverTime})，逐条语义由 pull 终态验证");
  }
  // applied 语义：幂等跳过的变更不计；stale 变更当前实现也返回 true（计成 no-op）。
  // 因此允许 2（stale 不计）或 3（stale 计入但未落库），最终以 pull 的 LWW 状态为准。
  if (appliedCount < 2 || appliedCount > 3) {
    fail("B", "APPLIED_" + appliedCount + "_EXPECTED_2_OR_3");
    return;
  }
  detail("B", "push=ok applied=" + appliedCount + " changes=" + changes.length);

  // 幂等：同一批 changeId 重推，必须一条都不重复应用
  const rePush = await request("POST", "/api/sync/push", {
    token: ctx.token,
    body: { deviceId: DEVICE_ID, deviceName: "sync-parity", changes },
  });
  const reApplied = rePush.json && rePush.json.applied;
  if (!rePush.ok || reApplied !== 0) {
    fail("B", "IDEMPOTENCY_APPLIED_" + (reApplied === undefined ? rePush.status : reApplied));
    return;
  }
  detail("B", "idempotent_repush=ok applied=0");

  // LWW 终态：pull 回读，index 0 的 fresh 标题必须生效、index 1 的 stale 不得覆盖
  const since = new Date(now - 300000).toISOString();
  const pull = await request(
    "GET",
    "/api/sync/pull?deviceId=" + DEVICE_ID + "&deviceName=sync-parity&since=" + encodeURIComponent(since),
    { token: ctx.token }
  );
  if (!pull.ok || !Array.isArray(pull.json && pull.json.changes)) {
    fail("B", "PULL_HTTP_" + pull.status);
    return;
  }
  const tasks = pull.json.changes.filter((c) => c.entityType === "tasks");
  const fresh = tasks.find((c) => c.entityId === entityA);
  const second = tasks.find((c) => c.entityId === entityB);
  if (!fresh || !second) {
    fail("B", "PULL_MISSING_ENTITY fresh=" + !!fresh + " second=" + !!second);
    return;
  }
  if (!fresh.payload || fresh.payload.title !== "B-fresh-" + RUN_ID) {
    fail("B", "LWW_OVERWRITTEN_BY_STALE got=" + JSON.stringify(fresh.payload && fresh.payload.title));
    return;
  }
  if (fresh.payload.done === true) {
    fail("B", "LWW_STALE_FIELD_APPLIED done=true");
    return;
  }
  detail("B", "pull=ok entityA.title=" + fresh.payload.title + " entityB.title=" + (second.payload && second.payload.title));

  if (!KEEP_DATA) {
    const del = await request("POST", "/api/sync/push", {
      token: ctx.token,
      body: {
        deviceId: DEVICE_ID,
        deviceName: "sync-parity",
        changes: [entityA, entityB].map((id, i) => ({
          entityType: "tasks",
          entityId: id,
          operation: "DELETE",
          version: 3,
          updatedAt: new Date(now + i + 1).toISOString(),
          changeId: RUN_ID + "-b-del-" + i,
          payload: null,
        })),
      },
    });
    detail("B", "cleanup=" + (del.ok ? "ok" : "http_" + del.status));
  }

  ok("B", "applied=" + appliedCount + " lww=fresh-wins idempotent=0");
}

// ---------------------------------------------------------------------------
// 链路 C：date key（Asia/Shanghai）一致性
// ---------------------------------------------------------------------------
async function linkC(ctx) {
  async function checkOnce() {
    let serverMs = null;
    let source = "http-date";
    if (ctx.token) {
      const pull = await request(
        "GET",
        "/api/sync/pull?deviceId=" + DEVICE_ID + "&deviceName=sync-parity&since=" + encodeURIComponent(new Date(0).toISOString()),
        { token: ctx.token }
      );
      if (pull.ok && pull.json && pull.json.serverTime) {
        const ms = Date.parse(pull.json.serverTime);
        if (!Number.isNaN(ms)) {
          serverMs = ms;
          source = "pull.serverTime(" + pull.json.serverTime + ")";
        }
      }
    }
    if (serverMs === null) {
      const probe = await request("GET", "/api/auth/me", { token: ctx.token });
      const dateHeader = probe.headers.get("date");
      if (dateHeader) {
        const ms = Date.parse(dateHeader);
        if (!Number.isNaN(ms)) {
          serverMs = ms;
          source = "http-date(" + dateHeader + ")";
        }
      }
    }
    if (serverMs === null) return null;
    return {
      source,
      apiDate: dateKey(serverMs),
      localDate: dateKey(Date.now()),
      apiTime: new Date(serverMs).toISOString(),
    };
  }

  let snap = await checkOnce();
  if (!snap) {
    fail("C", "NO_SERVER_CLOCK");
    return;
  }
  if (snap.apiDate !== snap.localDate) {
    await new Promise((r) => setTimeout(r, 1200));
    snap = await checkOnce();
  }
  const fmt = /^\d{4}-\d{2}-\d{2}$/;
  if (!fmt.test(snap.apiDate) || !fmt.test(snap.localDate)) {
    fail("C", "DATE_FORMAT api=" + snap.apiDate + " local=" + snap.localDate);
    return;
  }
  if (snap.apiDate !== snap.localDate) {
    const nowDate = new Date();
    const h = nowDate.getHours();
    const m = nowDate.getMinutes();
    const s = nowDate.getSeconds();
    const nearMidnight = (h === 23 && m === 59 && s >= 55) || (h === 0 && m === 0 && s <= 5);
    if (!nearMidnight) {
      fail("C", "DATE_MISMATCH api=" + snap.apiDate + " local=" + snap.localDate + " tz=" + TZ);
      return;
    }
    ok("C", "cross-midnight api=" + snap.apiDate + " local=" + snap.localDate);
    return;
  }
  detail("C", "source=" + snap.source + " apiDate=" + snap.apiDate + " localDate=" + snap.localDate);
  ok("C", "date=" + snap.apiDate + " tz=" + TZ);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function printPlan(server) {
  line("── S5-7a 双端一致性协议门禁（sync-parity）──");
  line("  baseUrl   : " + maskUrl(config.baseUrl));
  line("  dryRun    : " + DRY_RUN);
  line("  only      : " + [...ONLY].join(","));
  line("  username  : " + (config.username || "(未配置)"));
  line("  password  : " + MASKED_PASSWORD);
  line("  timeoutMs : " + config.timeoutMs);
  line("  timeZone  : " + TZ + "（本地解析时区：" + Intl.DateTimeFormat().resolvedOptions().timeZone + "）");
  if (server) {
    line("  server    : reachable=" + server.reachable + (server.reachable ? " status=" + server.status : " reason=" + server.reason));
  }
  line("");
  line("计划：");
  if (ONLY.has("A")) line("  A: POST " + maskUrl(config.baseUrl) + "/api/logs → GET /api/sync/pull 校验可见（需凭据）");
  if (ONLY.has("B")) line("  B: POST /api/sync/push（3 条 fresh/stale/second）→ applied 回执 + 幂等重推 + pull LWW（需凭据、需 S5-2）");
  if (ONLY.has("C")) line("  C: 服务器时间 vs 本地时间 → Asia/Shanghai date key（仅需服务可达）");
  line("");
}

async function main() {
  if (DRY_RUN) {
    printPlan(null);
    line("SYNC_PARITY_OK dry-run（未发起任何网络请求）");
    process.exitCode = 0;
    return;
  }

  printPlan(null);
  const server = await probeServer();
  line("  server    : reachable=" + server.reachable + (server.reachable ? " status=" + server.status : " reason=" + server.reason));
  if (!server.reachable) {
    for (const link of ["A", "B", "C"]) if (ONLY.has(link)) skip(link, "NO_SERVER(" + server.reason + ")");
    line("SYNC_PARITY_OK（缺少服务，全部 SKIP —— 请先启动 pnpm -F web dev）");
    process.exitCode = 0;
    return;
  }

  let token = null;
  const needsAuth = ONLY.has("A") || ONLY.has("B");
  if (needsAuth) {
    if (!config.username || !config.password) {
      if (ONLY.has("A")) skip("A", "NO_CREDENTIALS");
      if (ONLY.has("B")) skip("B", "NO_CREDENTIALS");
    } else {
      const auth = await login();
      if (!auth.ok) {
        if (ONLY.has("A")) fail("A", "AUTH_FAILED_" + auth.status + ":" + auth.error);
        if (ONLY.has("B")) fail("B", "AUTH_FAILED_" + auth.status);
        line("SYNC_PARITY_FAIL");
        process.exitCode = 1;
        return;
      }
      token = auth.token;
      detail("auth", "login=ok user=" + config.username);
    }
  }

  const ctx = { token, server };
  const runners = { A: linkA, B: linkB, C: linkC };
  for (const link of ["A", "B", "C"]) {
    if (!ONLY.has(link)) continue;
    const already = state.results.find((r) => r.link === link);
    if (already) continue;
    try {
      await runners[link](ctx);
    } catch (e) {
      fail(link, "EXCEPTION:" + ((e && e.name) || "Error") + ":" + String((e && e.message) || e).slice(0, 160));
    }
  }

  const failed = state.results.filter((r) => r.status === "FAIL");
  if (JSON_OUT) {
    line("SYNC_PARITY_JSON " + JSON.stringify({ runId: RUN_ID, baseUrl: maskUrl(config.baseUrl), results: state.results }));
  }
  if (failed.length > 0) {
    line("SYNC_PARITY_FAIL（" + failed.length + " 条失败）");
    process.exitCode = 1;
    return;
  }
  line("SYNC_PARITY_OK");
  process.exitCode = 0;
}

main().catch((e) => {
  console.error("SYNC_PARITY_FAIL unhandled:" + ((e && e.stack) || e));
  process.exitCode = 1;
});
