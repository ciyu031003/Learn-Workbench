/**
 * 把爬好的装备图库推到线上：图片进 COS 桶 + 元数据走内部导入接口入库。
 *
 * 用法：
 *   node scripts/import_equipment.mjs [--dir .local/equipment-out] \
 *        [--server ubuntu@106.55.2.197] [--remote /data/learn-workbench/equipment] \
 *        [--base https://learn.yuanabd.cn] [--env-file /home/ubuntu/learn-workbench/.env]
 *
 * 说明：CRON_SECRET 不在本地保存，运行时从服务器 .env 读取（只用于这一次调用）。
 */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const DIR = path.resolve(args.dir ?? ".local/equipment-out");
const SERVER = args.server ?? "ubuntu@106.55.2.197";
const REMOTE = args.remote ?? "/data/learn-workbench/equipment";
const BASE = (args.base ?? "https://learn.yuanabd.cn").replace(/\/+$/, "");
const ENV_FILE = args["env-file"] ?? "/home/ubuntu/learn-workbench/.env";

function run(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: 600000 });
  if (res.status !== 0) {
    throw new Error(cmd + " 失败（" + res.status + "）：" + ((res.stderr || "") + (res.stdout || "")).trim().split(/\r?\n/).slice(-3).join(" | "));
  }
  return (res.stdout || "").trim();
}

const manifestRaw = await readFile(path.join(DIR, "manifest.json"), "utf8");
const items = JSON.parse(manifestRaw);
if (!Array.isArray(items) || items.length === 0) {
  console.error("[import] manifest 为空，先跑 scripts/crawl_equipment.mjs");
  process.exit(1);
}
console.log("[import] 待导入 " + items.length + " 条");

// 1) 图片进桶（保持 <category>/<file>.webp 层级）
run("ssh", ["-o", "StrictHostKeyChecking=no", SERVER, "mkdir -p " + REMOTE]);
run("scp", ["-o", "StrictHostKeyChecking=no", "-r", path.join(DIR, "images") + "/.", SERVER + ":" + REMOTE + "/"]);
console.log("[import] 图片已上传 → " + REMOTE);

// 2) 取 CRON_SECRET（只读一次，不落盘）
const secret = run("ssh", ["-o", "StrictHostKeyChecking=no", SERVER, "grep -E '^CRON_SECRET=' " + ENV_FILE + " | head -1 | cut -d= -f2-"]);
if (!secret) {
  console.error("[import] 读不到 CRON_SECRET（" + ENV_FILE + "）");
  process.exit(1);
}

// 3) 调用内部导入接口
const res = await fetch(BASE + "/api/internal/equipment/import", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-cron-secret": secret },
  body: JSON.stringify({ items }),
});
const body = await res.json().catch(() => null);
if (!res.ok) {
  console.error("[import] 接口失败 " + res.status + "：" + JSON.stringify(body));
  process.exit(1);
}
console.log("[import] 入库完成：" + JSON.stringify(body));

