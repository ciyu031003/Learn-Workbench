/**
 * 内容包 → 统一内容模型同步（组二 · 阶段 7 = V3 Phase A）。
 *
 * 用法：
 *   node scripts/sync-content-model.mjs                 # 同步（默认读 git 上的内容包版本）
 *   node scripts/sync-content-model.mjs --dry-run       # 只预览 inserted/updated/unchanged，不写库
 *   node scripts/sync-content-model.mjs --review-ttl 90 # 覆盖复查周期（默认 180 天）
 *   node scripts/sync-content-model.mjs --api http://127.0.0.1:3001
 *
 * 鉴权：CRON_SECRET（与 cron / 面试导入同款 x-cron-secret）。
 * 需要服务已启动（同步逻辑在 Web 侧，因为它要读 packages/content 的 TS 内容包 + 写库）。
 */
import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key.slice(2)] = next;
      i++;
    } else out[key.slice(2)] = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const API_BASE = String(args.api ?? process.env.LWB_API_URL ?? "http://127.0.0.1:" + (process.env.APP_PORT ?? "3001")).replace(/\/+$/, "");
const CRON_SECRET = (process.env.CRON_SECRET ?? "").trim();
const DRY_RUN = Boolean(args["dry-run"]);

/** 内容包版本（git 上 packages/content/src/learning 的最后一次提交），拿不到就交给服务端兜底。 */
function readContentVersion() {
  try {
    const raw = execFileSync("git", ["log", "-1", "--format=%cI%n%h", "--", "packages/content/src/learning"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const [updatedAt, sha] = raw.split(/\r?\n/);
    if (!updatedAt || !sha) return {};
    return { contentVersion: sha.slice(0, 12), contentUpdatedAt: new Date(updatedAt).toISOString() };
  } catch {
    return {};
  }
}

async function main() {
  if (!CRON_SECRET) throw new Error("缺少 CRON_SECRET（同步接口鉴权需要）");
  const body = { ...readContentVersion() };
  if (DRY_RUN) body.dryRun = true;
  const ttl = Number(args["review-ttl"]);
  if (Number.isFinite(ttl) && ttl > 0) body.reviewTtlDays = ttl;

  console.log("[content-sync] 内容包版本：" + (body.contentVersion ?? "(服务端取 git)") + (DRY_RUN ? "（dry-run）" : ""));
  const res = await fetch(API_BASE + "/api/internal/content/sync", {
    method: "POST",
    headers: { "content-type": "application/json", "x-cron-secret": CRON_SECRET },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error("同步失败 HTTP " + res.status + " " + (data?.error ?? ""));

  console.log(
    "[content-sync] 知识点 新增 " + data.inserted + " / 更新 " + data.updated + " / 未变 " + data.unchanged +
      " / 归档 " + data.archived
  );
  console.log(
    "[content-sync] 关联 题↔知识点 " + data.links + " / 关系 " + data.relations + " / 前置 " + data.prerequisites
  );
  console.log("[content-sync] 待分类题 " + data.unlinkedQuestions + " 条；已过期知识点 " + data.stalePoints + " 个");
  console.log("[content-sync] 内容统计：" + JSON.stringify(data.stats ?? {}));
}

await main().catch((error) => {
  console.error("[content-sync] 失败：" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
