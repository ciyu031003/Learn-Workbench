#!/usr/bin/env node
/**
 * 外部来源内容导入（组二 · 阶段 10 = V3 纵线 Phase F）。
 *
 * 固定版本 → 许可/范围校验 → 解析 → 结构化 → 去重 → 关联 → dry-run 报告 → 小批量试导入 → 批次报告。
 *
 * 用法（`pnpm import:content -- --source=algorithms-java`）：
 *   --source=<key>     必填，对应 content_source.key
 *   --mode=apply       物化 review 草稿；缺省 dry-run（只出报告）
 *   --limit=N          只处理前 N 个候选文件（小批量试导入）
 *   --ref=<gitRef>     覆盖来源登记的固定版本（分支 / tag / sha）
 *   --repo-dir=<path>  本地克隆目录，缺省 .local/content-src/<sourceKey>
 *   --api=<baseUrl>    服务地址，缺省 LWB_API_URL 或 http://127.0.0.1:3001
 *
 * 归属（track/stage/topic）**不由脚本猜**：必须写在 content-platform/import-maps/<sourceKey>.json 里；
 * 没有映射的文件按 `unmapped` 记成 skip 明细 —— 既保留可审计的工作清单，也不假装"导入成功"。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  assertSafeGitRef,
  assertSafeRelativePath,
  assertSafeRepoUrl,
  buildImportItems,
  loadMappingFile,
  walkDocs,
} from "./lib/content-source.mjs";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    // 同时支持 `--key=value` 与 `--key value`（文档与 cron 用的都是前者）
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
const sourceKey = String(args.source ?? "").trim();
const mode = args.mode === "apply" || args.import === true ? "apply" : "dry-run";
const limit = Number(args.limit) > 0 ? Math.floor(Number(args.limit)) : 0;
const repoDir = path.resolve(ROOT, String(args["repo-dir"] ?? `.local/content-src/${sourceKey}`));
const mapPath = path.resolve(ROOT, String(args.map ?? `content-platform/import-maps/${sourceKey}.json`));
const API_BASE = String(args.api ?? process.env.LWB_API_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? "3001"}`).replace(/\/+$/, "");
const CRON_SECRET = (process.env.CRON_SECRET ?? "").trim();

const CONN = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
  database: process.env.PGDATABASE || "Learn-Workbench",
};

function log(message) {
  console.log(`[content-import] ${message}`);
}

/** 读来源登记：URL / 固定版本 / 许可 / 允许范围都来自库，不在脚本里硬编码。 */
async function loadSource() {
  const pool = new Pool({ ...CONN, connectionTimeoutMillis: 3000 });
  try {
    const { rows } = await pool.query(
      `SELECT key, name, url, repo, ref, license, usage, scope, status
         FROM content_source WHERE key = $1`,
      [sourceKey]
    );
    return rows[0] ?? null;
  } finally {
    await pool.end().catch(() => {});
  }
}

/**
 * 固定版本落地：已克隆则 fetch + 强制 checkout 到该版本；否则浅克隆。
 * 分支 / tag 用 `--branch` 克隆最省事；裸 sha 只能克隆后再 fetch+checkout（git 不支持 --branch <sha>）。
 */
/**
 * 所有 git 调用统一走这里（组三 · H3）：
 *  - `GIT_ALLOW_PROTOCOL=https` 关掉 file/ext/ssh 等传输，堵住"诱饵 URL → 命令执行"；
 *  - 传参一律走 argv 数组（不经 shell），配合 assertSafeGitRef 防选项注入。
 */
function runGit(gitArgs, opts = {}) {
  return execFileSync("git", gitArgs, {
    timeout: 600_000,
    ...opts,
    env: { ...process.env, GIT_ALLOW_PROTOCOL: "https", GIT_TERMINAL_PROMPT: "0", ...(opts.env ?? {}) },
  });
}

function syncRepo(url, ref) {
  assertSafeRepoUrl(url);
  assertSafeGitRef(ref);
  const bySha = /^[0-9a-f]{7,40}$/i.test(ref);
  if (fs.existsSync(path.join(repoDir, ".git"))) {
    runGit(["-C", repoDir, "fetch", "--quiet", "--depth", "1", "origin", ref], { timeout: 180_000 });
    runGit(["-C", repoDir, "checkout", "--quiet", "--force", "FETCH_HEAD"], { timeout: 60_000 });
  } else {
    fs.mkdirSync(path.dirname(repoDir), { recursive: true });
    if (bySha) {
      runGit(["clone", "--quiet", url, repoDir]);
      runGit(["-C", repoDir, "fetch", "--quiet", "--depth", "1", "origin", ref], { timeout: 180_000 });
      runGit(["-C", repoDir, "checkout", "--quiet", "--force", "FETCH_HEAD"], { timeout: 60_000 });
    } else {
      runGit(["clone", "--quiet", "--depth", "1", "--branch", ref, url, repoDir]);
    }
  }
  return runGit(["-C", repoDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

/** 许可核验：仓库根必须有 LICENSE*；许可为 UNKNOWN 且要物化时直接拒绝。 */
function verifyLicense(source) {
  const entries = fs.readdirSync(repoDir).filter((name) => /^license/i.test(name));
  if (entries.length === 0) {
    if (mode === "apply") throw new Error(`仓库根没有 LICENSE 文件，拒绝物化（${source.key}）`);
    log(`警告：仓库根没有 LICENSE 文件（${source.key}）`);
  }
  if (source.license === "UNKNOWN" && mode === "apply") {
    throw new Error(`来源许可未核验（license=UNKNOWN），拒绝物化（${source.key}）`);
  }
}

async function main() {
  if (!sourceKey) throw new Error("缺少 --source=<content_source.key>");
  if (!CRON_SECRET) throw new Error("缺少 CRON_SECRET（导入接口鉴权需要）");

  const source = await loadSource();
  if (!source) throw new Error(`来源未登记：${sourceKey}（先补 content_source）`);
  if (source.status !== "active") throw new Error(`来源已停用（status=${source.status}）：${sourceKey}`);
  if (source.usage !== "import" && mode === "apply") {
    throw new Error(`来源 usage=${source.usage} 只允许 dry-run：只保留外链，不复制正文`);
  }

  const ref = assertSafeGitRef(args.ref ?? source.ref ?? "main");
  log(`来源 ${source.key}（${source.name}）· 固定版本 ${ref} · 模式 ${mode}`);
  const commitSha = syncRepo(source.url, ref);
  log(`commit ${commitSha.slice(0, 12)}`);
  verifyLicense(source);

  const scope = Array.isArray(source.scope) ? source.scope : [];
  const mapping = loadMappingFile(mapPath);
  if (mapping.missing) log(`提示：没有映射文件 ${path.relative(ROOT, mapPath)} —— 全部文件会记为 unmapped`);

  const docs = walkDocs(repoDir);
  const { items, parsed } = buildImportItems({
    docs,
    readText: (rel) => fs.readFileSync(path.join(repoDir, assertSafeRelativePath(rel)), "utf8"),
    mapping: mapping.entries,
    scope,
    limit,
    license: source.license,
  });

  log(`候选文件 ${docs.length} 个，可解析 ${parsed} 个，提交导入 ${items.length} 条`);
  if (items.length === 0) {
    log("没有可提交条目，结束");
    return;
  }

  const res = await fetch(`${API_BASE}/api/internal/content/import`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cron-secret": CRON_SECRET },
    body: JSON.stringify({ sourceKey, mode, commitSha, scope, items, createdBy: "cli" }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`导入接口失败 HTTP ${res.status} ${data?.error ?? ""}`);

  const counts = data.counts ?? {};
  log(`批次 #${data.batchId} · 状态 ${data.status}`);
  log(
    `新增 ${counts.new ?? 0} / 更新 ${counts.update ?? 0} / 跳过 ${counts.skip ?? 0} / ` +
      `冲突 ${counts.conflict ?? 0} / 失败 ${counts.failed ?? 0}`
  );
  if (data.staged?.questions) log(`题目工作项 ${data.staged.questions} 条（待人工写进内容包）`);
  if ((counts.conflict ?? 0) > 0) log("有冲突：需要人工看 content_import_item.reason 再决定是否映射");

  const reportDir = path.join(ROOT, ".local", "import-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${sourceKey}-${data.batchId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ ...data, commitSha, ref }, null, 2), "utf8");
  log(`报告已落盘 ${path.relative(ROOT, reportPath)}`);

  if ((counts.failed ?? 0) > 0) process.exitCode = 1;
}

await main().catch((error) => {
  console.error(`[content-import] 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
