/**
 * 把抓好的面试题库推到线上（v12 P2-1）：
 *  1) 按模块分块的 JSON 进 COS 桶（/data/learn-workbench/interview/，APP 侧按需读取）；
 *  2) 元数据走内部导入接口入库（interview_questions，带来源与 license，可一键下架）。
 *
 * 用法：node scripts/import_interview.mjs [--dir .local/interview-out] [--server ubuntu@106.55.2.197]
 *        [--remote /data/learn-workbench/interview] [--base https://learn.yuanabd.cn]
 *
 * CRON_SECRET 只在运行时从服务器 .env 读一次，不落盘。
 */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
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
const DIR = path.resolve(args.dir ?? ".local/interview-out");
const SERVER = args.server ?? "ubuntu@106.55.2.197";
const REMOTE = args.remote ?? "/data/learn-workbench/interview";
const BASE = (args.base ?? "https://learn.yuanabd.cn").replace(/\/+$/, "");
const ENV_FILE = args["env-file"] ?? "/home/ubuntu/learn-workbench/.env";

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: 900000, ...opts });
  if (res.status !== 0) {
    throw new Error(cmd + " 失败（" + res.status + "）：" + ((res.stderr || "") + (res.stdout || "")).trim().split(/\r?\n/).slice(-3).join(" | "));
  }
  return (res.stdout || "").trim();
}

const items = JSON.parse(await readFile(path.join(DIR, "manifest.json"), "utf8"));
if (!Array.isArray(items) || items.length === 0) {
  console.error("[interview] manifest 为空，先跑 scripts/crawl_interview.mjs");
  process.exit(1);
}
console.log("[interview] 待导入 " + items.length + " 条");

// 1) 分块 JSON 进桶（APP / 其它端可按模块直接读）
run("ssh", ["-o", "StrictHostKeyChecking=no", SERVER, "mkdir -p " + REMOTE]);
run("scp", ["-o", "StrictHostKeyChecking=no", "-r", path.join(DIR, "chunks") + "/.", SERVER + ":" + REMOTE + "/"]);
console.log("[interview] 分块 JSON 已上传 → " + REMOTE);

// 2) 取 CRON_SECRET（只读一次，不落盘）
const secret = run("ssh", ["-o", "StrictHostKeyChecking=no", SERVER, "grep -E '^CRON_SECRET=' " + ENV_FILE + " | head -1 | cut -d= -f2-"]);
if (!secret) {
  console.error("[interview] 读不到 CRON_SECRET（" + ENV_FILE + "）");
  process.exit(1);
}

// 3) 入库（分批，接口单次上限 1000）
let imported = 0;
let skipped = 0;
for (let i = 0; i < items.length; i += 500) {
  const batch = items.slice(i, i + 500);
  const res = await fetch(BASE + "/api/internal/interview/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: JSON.stringify({ items: batch }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("[interview] 接口失败 " + res.status + "：" + JSON.stringify(body));
    process.exit(1);
  }
  imported += Number(body?.imported ?? 0);
  skipped += Array.isArray(body?.skipped) ? body.skipped.length : 0;
  console.log("[interview] 第 " + (i / 500 + 1) + " 批：" + JSON.stringify(body));
}
console.log("[interview] 入库完成：imported=" + imported + " skipped=" + skipped);
