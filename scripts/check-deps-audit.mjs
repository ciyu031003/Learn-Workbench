#!/usr/bin/env node
/**
 * 依赖漏洞棘轮门禁（组三 · H3 依赖扫描 / H4 交付补强）。
 *
 * 为什么不直接 `pnpm audit --audit-level=high`：
 * 现状实测 53 条（4 critical / 33 high / 15 moderate / 1 low），一次性清零不现实，
 * 硬门禁只会让 CI 长期红着（然后就没人看了）。门禁的价值是**不许变多**：
 * 跑 audit → 与基线比对 → 任一严重度超过基线即失败；变少则提示收紧基线。
 *
 * 用法：
 *   node scripts/check-deps-audit.mjs            # 校验（CI）
 *   node scripts/check-deps-audit.mjs --update   # 更新基线（必须在本 PR 里说明为什么）
 * 环境变量：AUDIT_REGISTRY（默认 https://registry.npmjs.org —— npmmirror 没有 audit 端点）
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "content-platform", "security", "deps-baseline.json");
const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const REGISTRY = process.env.AUDIT_REGISTRY || "https://registry.npmjs.org";
const UPDATE = process.argv.includes("--update");

function runAuditJson() {
  const args = ["audit", "--json", "--registry", REGISTRY];
  const spawnOpts = { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 };
  try {
    // Windows 上 pnpm 是 .cmd，需要 shell；REGISTRY 是常量 URL（无用户输入），不存在注入面。
    const stdout =
      process.platform === "win32"
        ? execFileSync(`pnpm ${args.join(" ")}`, { ...spawnOpts, shell: true })
        : execFileSync("pnpm", args, spawnOpts);
    return JSON.parse(String(stdout));
  } catch (error) {
    // pnpm audit 在发现漏洞时退出码非 0，JSON 仍在 stdout 上
    const stdout = String(error?.stdout ?? "");
    if (!stdout.trim()) {
      throw new Error(
        `pnpm audit 没有输出（registry ${REGISTRY} 可能不支持 audit 端点）：${error?.message ?? error}`
      );
    }
    return JSON.parse(stdout);
  }
}

function countsOf(report) {
  const vulns = report?.metadata?.vulnerabilities ?? {};
  const out = {};
  for (const s of SEVERITIES) out[s] = Number(vulns[s] ?? 0);
  return out;
}

/** 稳定排序的漏洞指纹，用于"新增了哪几条"的可读 diff。 */
function fingerprints(report) {
  const advisories = report?.advisories ?? {};
  return Object.values(advisories)
    .map((a) => `${a.severity}:${a.module_name}:${a.github_advisory_id ?? a.id ?? "?"}`)
    .sort();
}

const report = runAuditJson();
const counts = countsOf(report);
const fps = fingerprints(report);

if (UPDATE) {
  mkdirSync(path.dirname(BASELINE), { recursive: true });
  const payload = {
    _comment:
      "依赖漏洞基线（棘轮）：只许减少。由 node scripts/check-deps-audit.mjs --update 写入。" +
      "更新时必须说明原因（修了什么 / 为什么新增可接受）。",
    updatedAt: new Date().toISOString(),
    registry: REGISTRY,
    counts,
    advisories: fps,
  };
  writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`[deps-audit] 基线已更新：${JSON.stringify(counts)} → ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error("[deps-audit] 缺少基线文件，先跑 node scripts/check-deps-audit.mjs --update");
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const baseCounts = baseline.counts ?? {};
const regressions = [];
const improvements = [];
for (const s of SEVERITIES) {
  const now = counts[s] ?? 0;
  const before = Number(baseCounts[s] ?? 0);
  if (now > before) regressions.push(`${s}: ${before} → ${now}`);
  if (now < before) improvements.push(`${s}: ${before} → ${now}`);
}

const baseSet = new Set(baseline.advisories ?? []);
const added = fps.filter((f) => !baseSet.has(f));

if (regressions.length || added.length) {
  console.error("[deps-audit] 依赖漏洞相对基线变多了：");
  for (const r of regressions) console.error(`  - ${r}`);
  for (const a of added) console.error(`  - 新增：${a}`);
  console.error("  处理：升级/替换依赖，或在 PR 里说明后跑 --update 收紧基线。");
  process.exitCode = 1;
} else {
  console.log(`[deps-audit] 未超过基线 ✔（${JSON.stringify(counts)}）`);
}

if (improvements.length) {
  console.log(`[deps-audit] 好于基线，可跑 --update 收紧：${improvements.join("；")}`);
}
