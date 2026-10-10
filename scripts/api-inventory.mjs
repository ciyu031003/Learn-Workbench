#!/usr/bin/env node
/**
 * 生成 `content-platform/api/route-inventory.md`（组三 · H2 台账）并做三条硬门槛检查。
 *
 * 门槛（`--check`，已进 test:scripts → CI）：
 *   ① 每个 `route.ts` 必须有同名 `route.test.ts`（存量欠账在 test-exceptions.json 显式登记）；
 *   ② `api/internal/**` 必须过限流（`rateLimit(`），否则内部重操作可被反复触发；
 *   ③ 契约范围内的命名空间（见 CONTRACT_SCOPE）必须在 `content-platform/openapi/*.md` 有条目。
 *
 * 用法：
 *   node scripts/api-inventory.mjs          # 写入台账
 *   node scripts/api-inventory.mjs --check  # 只比对 + 检查门槛（漂移或违规即失败）
 */
import { readdirSync, readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API_ROOT = path.join(ROOT, "apps", "web", "app", "api");
const OUT = path.join(ROOT, "content-platform", "api", "route-inventory.md");
const EXCEPTIONS = path.join(ROOT, "content-platform", "api", "test-exceptions.json");
const OPENAPI_DIR = path.join(ROOT, "content-platform", "openapi");

/** 必须有 OpenAPI 条目（H2 覆盖率从这些命名空间开始，其余存量按台账跟进）。 */
const CONTRACT_SCOPE = ["/api/internal/content", "/api/learning"];

const CHECK = process.argv.includes("--check");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** `apps/web/app/api/jobs/[id]/plan/route.ts` → `/api/jobs/[id]/plan` */
function apiPath(file) {
  const rel = path.relative(path.join(ROOT, "apps", "web", "app"), path.dirname(file));
  return "/" + rel.split(path.sep).join("/");
}

function readExceptions() {
  if (!existsSync(EXCEPTIONS)) return { missingTests: {}, unthrottled: {} };
  const parsed = JSON.parse(readFileSync(EXCEPTIONS, "utf8"));
  return { missingTests: parsed.missingTests ?? {}, unthrottled: parsed.unthrottled ?? {} };
}

function loadOpenApiText() {
  if (!existsSync(OPENAPI_DIR)) return "";
  return readdirSync(OPENAPI_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(path.join(OPENAPI_DIR, f), "utf8"))
    .join("\n");
}

function collect() {
  const openapi = loadOpenApiText();
  return walk(API_ROOT)
    .map((file) => {
      const src = readFileSync(file, "utf8");
      const dir = path.dirname(file);
      return {
        file: path.relative(ROOT, file).split(path.sep).join("/"),
        api: apiPath(file),
        methods: METHODS.filter((m) => new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(src)),
        auth: /currentUserId\(/.test(src) ? "登录" : /x-cron-secret/.test(src) ? "内部密钥" : "公开",
        // 限流：直接调 rateLimit，或走统一前门 guardInternalRequest（后者更推荐）。
        rateLimited: /rateLimit\(|guardInternalRequest\(/.test(src),
        throttledViaGuard: /guardInternalRequest\(/.test(src),
        hasTest: existsSync(path.join(dir, "route.test.ts")),
        documented: openapi.includes(apiPath(file)),
      };
    })
    .sort((a, b) => a.api.localeCompare(b.api));
}

function render(routes) {
  const total = routes.length;
  const withTest = routes.filter((r) => r.hasTest).length;
  const throttled = routes.filter((r) => r.rateLimited).length;
  const internal = routes.filter((r) => r.api.startsWith("/api/internal/"));
  const documented = routes.filter((r) => r.documented).length;
  const lines = [];
  lines.push("# API 路由台账（组三 · H2）");
  lines.push("");
  lines.push("> **本文件由脚本生成，请勿手改**：`node scripts/api-inventory.mjs`。");
  lines.push("> 门槛：新增路由必须有同名测试、`api/internal/**` 必须限流、契约范围内必须有 OpenAPI 条目。");
  lines.push(`> 契约范围：${CONTRACT_SCOPE.map((s) => `\`${s}/**\``).join("、")}；欠账登记在 \`api/test-exceptions.json\`。`);
  lines.push("");
  lines.push("## 1. 总览");
  lines.push("");
  lines.push("| 指标 | 数值 |");
  lines.push("|---|---|");
  lines.push(`| 路由总数 | ${total} |`);
  lines.push(`| 有同名单测 | ${withTest} / ${total} |`);
  lines.push(`| 已限流 | ${throttled} / ${total} |`);
  lines.push(`| 内部接口（\`api/internal/**\`） | ${internal.length}（已限流 ${internal.filter((r) => r.rateLimited).length}） |`);
  lines.push(`| 已有 OpenAPI 条目 | ${documented} / ${total} |`);
  lines.push("");
  lines.push("## 2. 未文档化清单（H2 跟进，不阻断）");
  lines.push("");
  const undocumented = routes.filter((r) => !r.documented && !CONTRACT_SCOPE.some((s) => r.api.startsWith(s)));
  lines.push(`共 ${undocumented.length} 个：${undocumented.map((r) => `\`${r.api}\``).join("、") || "无"}`);
  lines.push("");
  lines.push("## 3. 全量台账");
  lines.push("");
  lines.push("| 路由 | 方法 | 鉴权 | 限流 | 单测 | 文档 |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of routes) {
    lines.push(
      `| \`${r.api}\` | ${r.methods.join(" ") || "-"} | ${r.auth} | ${r.rateLimited ? "✅" : "—"} | ${r.hasTest ? "✅" : "❌"} | ${r.documented ? "✅" : "—"} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

const routes = collect();
const exceptions = readExceptions();
const violations = [];

for (const r of routes) {
  if (!r.hasTest && !exceptions.missingTests[r.api]) violations.push(`缺单测：\`${r.api}\``);
  if (r.api.startsWith("/api/internal/") && !r.rateLimited && !exceptions.unthrottled[r.api]) {
    violations.push(`内部接口未限流：\`${r.api}\``);
  }
  if (CONTRACT_SCOPE.some((s) => r.api.startsWith(s)) && !r.documented) {
    violations.push(`契约范围内缺 OpenAPI 条目：\`${r.api}\``);
  }
}

const markdown = render(routes);

if (CHECK) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  let failed = false;
  if (current !== markdown) {
    console.error("[api-inventory] 台账过期，请运行 node scripts/api-inventory.mjs 重新生成");
    failed = true;
  }
  if (violations.length) {
    for (const v of violations) console.error(`[api-inventory] 违规：${v}`);
    failed = true;
  }
  if (failed) process.exitCode = 1;
  else console.log(`[api-inventory] 台账最新 ✔（路由 ${routes.length}，门槛 3/3 通过）`);
} else {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, markdown, "utf8");
  console.log(`[api-inventory] 已生成 ${path.relative(ROOT, OUT)}（路由 ${routes.length}）`);
  for (const v of violations) console.log(`[api-inventory][warn] ${v}`);
}
