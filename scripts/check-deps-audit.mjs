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
 *   node scripts/check-deps-audit.mjs                       # 校验（CI）
 *   node scripts/check-deps-audit.mjs --update              # 更新基线（必须在本 PR 里说明为什么）
 *   node scripts/check-deps-audit.mjs --audit-json <file>   # 用外部审计结果（不跑 pnpm）
 * 环境变量：
 *   AUDIT_REGISTRY  默认 https://registry.npmjs.org —— **npmmirror 没有 audit 端点**，
 *                   用默认 registry 会得到 ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS（见下）。
 *   AUDIT_PNPM      pnpm CLI 入口（.cjs/.mjs/.js）路径，覆盖自动探测。
 *
 * v1.44.0（门禁可信度修复）：
 *   1. 旧实现 Windows 上走 execFileSync("pnpm audit --json", { shell: true })，
 *      在受限环境下 spawnSync cmd.exe 直接 EPERM 崩栈（连"发生了什么"都看不到）。
 *      现在**不依赖 shell 包装**：自动定位 pnpm 的 JS 入口，用 process.execPath 直接跑；
 *      输出走临时文件描述符（受限环境禁止管道 stdio），因此本机与 CI 行为一致。
 *   2. 新增 --audit-json <file>：审计在别处跑完后把 JSON 喂进来，CI/离线都能用。
 *   3. registry 不支持 audit 端点时给出可读诊断（含补救命令），而不是崩栈。
 */
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "content-platform", "security", "deps-baseline.json");
const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const REGISTRY = process.env.AUDIT_REGISTRY || "https://registry.npmjs.org";
const UPDATE = process.argv.includes("--update");
const auditJsonArg = process.argv.find((a) => a.startsWith("--audit-json="));
const auditJsonIdx = process.argv.indexOf("--audit-json");
const AUDIT_JSON_FILE = auditJsonArg ? auditJsonArg.slice("--audit-json=".length) : auditJsonIdx >= 0 ? process.argv[auditJsonIdx + 1] : null;
if (auditJsonIdx >= 0 && !process.argv[auditJsonIdx + 1]) {
  console.error("[deps-audit] --audit-json 需要一个文件路径参数");
  process.exit(1);
}

/**
 * 定位 pnpm 的 **JS 入口**（不是 .cmd 包装器）。
 * 为什么：Windows 上 pnpm.cmd 必须经 cmd.exe 才能执行，而受限环境禁止 spawn cmd.exe（EPERM）。
 * 找到 pnpm.mjs/.cjs 后用 process.execPath 直接跑，既不需要 shell，也不受平台限制。
 */
function resolvePnpmCli() {
  if (process.env.AUDIT_PNPM) {
    if (!existsSync(process.env.AUDIT_PNPM)) {
      throw new Error(`AUDIT_PNPM 指向的文件不存在：${process.env.AUDIT_PNPM}`);
    }
    return process.env.AUDIT_PNPM;
  }
  const candidates = [
    // npm/pnpm 全局安装目录（本机实测路径）
    path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.cjs"),
    path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs"),
    path.join(process.env.LOCALAPPDATA ?? "", "pnpm", "pnpm.cjs"),
    // pnpm 自带 shim 目录
    path.join(process.env.PNPM_HOME ?? "", "pnpm.cjs"),
    // 仓库内（pnpm 作为依赖时）
    path.join(ROOT, "node_modules", "pnpm", "bin", "pnpm.cjs"),
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

/** JSON.parse 前先剥掉 UTF-8 BOM —— PowerShell `>` 重定向导出的 JSON 常带 BOM，会直接 SyntaxError。 */
function parseJsonLoose(text, source) {
  const cleaned = String(text).replace(/^\uFEFF/, "");
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(
      source + " 不是合法 JSON：" + String(error.message).split("\n")[0] + "\n  前 200 字符：" + cleaned.slice(0, 200)
    );
  }
}

/** 跑 pnpm，stdout 走临时文件（受限环境禁止管道 stdio）。返回 { stdout, status, stderr }。 */
function execPnpmCapture(args) {
  const cli = resolvePnpmCli();
  if (!cli) {
    throw new Error(
      "找不到 pnpm 的 JS 入口（pnpm.cjs/.mjs）。处理：设置环境变量 AUDIT_PNPM 指向它，" +
        "或改用 --audit-json <file> 注入外部审计结果。"
    );
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), "lwb-audit-"));
  const outFile = path.join(dir, "stdout.json");
  const errFile = path.join(dir, "stderr.txt");
  let fdOut;
  let fdErr;
  let status = 0;
  try {
    fdOut = openSync(outFile, "w");
    fdErr = openSync(errFile, "w");
    execFileSync(process.execPath, [cli, ...args], {
      cwd: ROOT,
      stdio: ["ignore", fdOut, fdErr],
    });
  } catch (error) {
    // pnpm audit 发现漏洞时退出码非 0，JSON 仍在 stdout 上
    if (error?.code === "ENOENT" || error?.code === "EPERM" || error?.code === "EACCES") {
      throw new Error("无法执行 pnpm（" + error.code + "）：" + String(error.message).split("\n")[0]);
    }
    status = error?.status ?? 1;
  } finally {
    if (fdOut !== undefined) closeSync(fdOut);
    if (fdErr !== undefined) closeSync(fdErr);
  }
  try {
    return { stdout: readFileSync(outFile, "utf8"), stderr: readFileSync(errFile, "utf8"), status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runAuditJson() {
  if (AUDIT_JSON_FILE) {
    if (!existsSync(AUDIT_JSON_FILE)) {
      throw new Error(`--audit-json 指定的文件不存在：${AUDIT_JSON_FILE}`);
    }
    console.log(`[deps-audit] 使用外部审计结果：${AUDIT_JSON_FILE}`);
    return parseJsonLoose(readFileSync(AUDIT_JSON_FILE, "utf8"), `--audit-json 文件 ${AUDIT_JSON_FILE}`);
  }

  const { stdout, stderr, status } = execPnpmCapture(["audit", "--json", "--registry", REGISTRY]);
  if (!stdout.trim()) {
    // 把 pnpm 自己的诊断转成人能读的提示，而不是崩栈
    const hint = stderr.includes("ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS")
      ? `当前 registry（${REGISTRY}）没有 audit 端点（pnpm 报 ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS）。` +
        "npmmirror 等镜像普遍不支持，改用官方源：AUDIT_REGISTRY=https://registry.npmjs.org，" +
        "或 \`node scripts/check-deps-audit.mjs --audit-json <已导出的 audit JSON>\`。"
      : "pnpm audit 没有产生 JSON 输出。";
    throw new Error(hint + "\n  pnpm stderr：" + (stderr.trim().split("\n").slice(-5).join("\n  ") || "(空)"));
  }
  const report = parseJsonLoose(stdout, "pnpm audit 的输出（registry " + REGISTRY + " 可能返回了 HTML 错误页）");
  assertAuditReport(report, stdout);
  return report;
}

/**
 * 校验审计报告形状 —— **这是本脚本最容易静默通过的地方**。
 *
 * 实测（2026-10-11）：registry 没有 audit 端点时，pnpm 把错误当作**正常 JSON 写到 stdout**
 * 并以退出码 1 结束（stderr 为空）：
 *   {"error":{"code":"ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS","message":"..."}}
 * 旧实现直接 countsOf() 取值 → 全 0 → 打印「未超过基线 ✔」exit 0。
 * 也就是说：**换一个镜像源就能让依赖门禁永远绿灯**，必须硬失败。
 */
function assertAuditReport(report, rawStdout) {
  if (report?.error) {
    const code = report.error.code ?? "?";
    const hint =
      code === "ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS"
        ? "当前 registry（" + REGISTRY + "）没有 audit 端点（npmmirror 等镜像普遍不支持）。" +
          "改用官方源：AUDIT_REGISTRY=https://registry.npmjs.org，" +
          "或 --audit-json <已导出的 audit JSON>。"
        : "pnpm 返回了错误对象：" + (report.error.message ?? JSON.stringify(report.error));
    throw new Error(hint);
  }
  const vulns = report?.metadata?.vulnerabilities;
  if (!vulns || typeof vulns !== "object") {
    throw new Error(
      "pnpm audit 的报告里没有 metadata.vulnerabilities，无法判定漏洞数量（不能当成 0）。" +
        "\n  前 200 字符：" + String(rawStdout).slice(0, 200)
    );
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

// 审计不可得（registry 无端点 / 输出不合法 / pnpm 不可用）时给**可读诊断**，
// 而不是把 Node 的堆栈甩给使用者 —— 门禁失败必须让人一眼知道下一步做什么。
let report;
try {
  report = runAuditJson();
} catch (error) {
  console.error("[deps-audit] 无法获得审计结果（依赖门禁无法判定，按失败处理）：");
  console.error("  " + (error instanceof Error ? error.message : String(error)).split("\n").join("\n  "));
  process.exit(1);
}
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
