#!/usr/bin/env node
/**
 * 首载 JS 体积预算门禁（S3-4）。
 *
 * 数据源：next build 生成的 .next/diagnostics/route-bundle-stats.json
 *   [{ route, firstLoadUncompressedJsBytes, firstLoadChunkPaths: string[] }]
 * 预算（gzip）：
 *   - 落地页 / ≤ 138KB（S8-b 后实测 134.8KB；框架基线 131.0KB + 根布局 client shell 3.8KB，
 *     目标 ≤130KB 已被 Next16/React19 框架基线本身顶住，详见 S8-b 汇报的瓶颈构成）；
 *   - 其余公开页（/login、/share/**）≤ 158KB（S8-b 后实测 login 155.6KB / share 151.0KB，
 *     改造前分别是 157.8 / 165.0KB）；
 *   - 重型页（/learn/**、/wellbeing/nutrition）≤ 400KB；
 *   - 其余应用页 ≤ 300KB。
 *
 * 用法：
 *   node scripts/check-bundle-budget.mjs                 # 打印报告（不失败）
 *   node scripts/check-bundle-budget.mjs --check         # 超预算即 exit 1
 *   node scripts/check-bundle-budget.mjs --json          # 机器可读
 *   node scripts/check-bundle-budget.mjs --allow-missing # 无产物时跳过（用于未 build 的 CI 前置）
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STATS = path.join(ROOT, "apps/web/.next/diagnostics/route-bundle-stats.json");

const args = new Set(process.argv.slice(2));
const CHECK = args.has("--check");
const JSON_OUT = args.has("--json");
const ALLOW_MISSING = args.has("--allow-missing");

// landing 135 = 实测 Next16 App Router 首载 JS 地板（react-dom 69.9 + App Router 41.8 + router 8.3 + turbopack 4.2 + BFCache 3.6 + next/link 3.5 + error-styles 3.5 ≈ 134.8KB，业务 JS 已为 0）
export const BUDGETS_KB = { landing: 135, public: 158, heavy: 400, app: 300 };

/**
 * 按路由的预算覆盖（有明确理由才加，且必须写清原因）：
 * - S8-b 起不再需要覆盖：/login 与 /share 已回落到 158KB 通用公开页预算内
 *   （改造前 165/175KB 的覆盖已删除，避免预算长期虚高）。
 */
const ROUTE_BUDGET_KB = {};

export function classifyRoute(route) {
  if (route === "/") return "landing";
  if (route === "/login" || route.startsWith("/share")) return "public";
  if (route.startsWith("/learn") || route === "/wellbeing/nutrition") return "heavy";
  return "app";
}

/** chunk 路径 → gzip 字节数（带缓存；文件缺失按 0 计并记录） */
export function makeGzipSizer(root = path.join(ROOT, "apps/web"), cache = new Map()) {
  const missing = [];
  const size = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    // route-bundle-stats 里的路径相对 apps/web（如 ".next/static/chunks/x.js"），Windows 上可能带反斜杠
    const normalized = String(rel).split("\\").join("/");
    const abs = path.isAbsolute(normalized) ? normalized : path.join(root, normalized);
    let n = 0;
    try {
      n = gzipSync(readFileSync(abs)).length;
    } catch {
      missing.push(rel);
    }
    cache.set(rel, n);
    return n;
  };
  return { size, missing };
}

export function summarize(stats, sizer) {
  return stats
    .map((r) => {
      const bytes = (r.firstLoadChunkPaths ?? []).reduce((sum, p) => sum + sizer.size(p), 0);
      const kind = classifyRoute(r.route);
      const budgetKb = ROUTE_BUDGET_KB[r.route] ?? BUDGETS_KB[kind];
      return { route: r.route, kind, gzipKb: Math.round(bytes / 1024), budgetKb, over: bytes > budgetKb * 1024 };
    })
    .sort((a, b) => b.gzipKb - a.gzipKb);
}

function main() {
  if (!existsSync(STATS)) {
    const msg = "[bundle-budget] 未找到 .next/diagnostics/route-bundle-stats.json（需要先 next build）";
    if (ALLOW_MISSING) {
      console.log(msg + " → 跳过（--allow-missing）");
      return;
    }
    console.error(msg);
    process.exitCode = 1;
    return;
  }
  const stats = JSON.parse(readFileSync(STATS, "utf8"));
  const sizer = makeGzipSizer();
  const { size } = sizer;
  const { missing } = sizer;
  const rows = summarize(stats, { size });
  const over = rows.filter((r) => r.over);

  if (JSON_OUT) {
    console.log(JSON.stringify({ budgets: BUDGETS_KB, routes: rows, over: over.length, missingChunks: missing.length }, null, 2));
  } else {
    console.log("[bundle-budget] 首载 JS（gzip）按体积排序：");
    for (const r of rows) {
      console.log(
        `  ${r.over ? "✗" : "✓"} ${r.gzipKb.toString().padStart(4)}KB / ${String(r.budgetKb).padStart(3)}KB  [${r.kind}] ${r.route}`
      );
    }
    const count = (kind) => rows.filter((r) => r.kind === kind).length;
    console.log(
      `[bundle-budget] 路由 ${rows.length}（public ${count("public")} / app ${count("app")} / heavy ${count("heavy")}），超预算 ${over.length} 个` +
        (missing.length ? `，缺失 chunk ${missing.length} 个` : "")
    );
  }

  if (over.length) {
    if (!JSON_OUT) console.error("[bundle-budget] 超预算路由：" + over.map((r) => r.route).join(", "));
    if (CHECK) process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
