#!/usr/bin/env node
/**
 * 三类演练一条命令（S7-2）：backup / rollback / alert。
 *
 * 用法：
 *   node scripts/drill.mjs                        # 全部演练（backup 默认只做 dry-run 恢复校验）
 *   node scripts/drill.mjs --only=backup,alert    # 只跑指定演练
 *   node scripts/drill.mjs --full                 # backup 做真实恢复（restore-drill 不带 --dry-run）
 *   node scripts/drill.mjs --json                 # 只输出一段 JSON（CI 消费）
 *
 * 输出合同（stdout）：
 *   每个演练一行：DRILL_BACKUP=PASS|FAIL|SKIP
 *   汇总一行：    DRILL_SUMMARY ok=n fail=n skip=n exit=0|1
 *   --json：单个 JSON 对象（不再输出上面两种人类行）
 * 人类可读细节（每条 check / 失败原因 / stderr 摘要）一律写 stderr。
 *
 * 退出码：0 = 无 FAIL（含 SKIP）；1 = 有 FAIL；2 = 参数错误。
 *
 * 环境：
 *   DRILL_BASH=<bash 路径>        指定 bash（Windows 自动发现 Git Bash；无 bash 时 rollback 动态段 SKIP）
 *   DRILL_PGHOST / DRILL_PGPORT / DRILL_PGUSER / DRILL_PGDATABASE   backup 演练 PG 连接（默认 127.0.0.1:5432 / Learn-Workbench）
 *   DRILL_PG_BIN / PG_DUMP_BIN / PG_RESTORE_BIN   pg 工具位置
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { detectBash, ROOT, IS_WINDOWS, banner } from "./drill/lib.mjs";

const DRILL_KEYS = ["backup", "rollback", "alert"];

function parseArgs(argv) {
  const opts = { only: null, json: false, full: false, help: false };
  for (const arg of argv) {
    if (arg === "--json") opts.json = true;
    else if (arg === "--full") opts.full = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--only=")) {
      const list = arg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean);
      opts.only = (opts.only || []).concat(list);
    } else {
      return { error: "未知参数 " + arg };
    }
  }
  if (opts.only) {
    const unknown = opts.only.filter((k) => !DRILL_KEYS.includes(k));
    if (unknown.length) return { error: "--only 含未知演练：" + unknown.join(",") + "（可选 " + DRILL_KEYS.join(",") + "）" };
    if (opts.only.length === 0) return { error: "--only 不能为空" };
  }
  return { opts };
}

function usage() {
  console.log("用法：node scripts/drill.mjs [--only=backup,rollback,alert] [--full] [--json]");
  console.log("演练：backup（备份+恢复校验）、rollback（回滚脚本静态+shim 动态）、alert（告警四条路径）");
}

async function runOne(key, ctx) {
  const modPath = path.join(ROOT, "scripts", "drill", key + ".mjs");
  try {
    const mod = await import(pathToFileURL(modPath).href);
    if (typeof mod.run !== "function") {
      return { name: key, status: "FAIL", reason: modPath + " 未导出 run()", checks: [] };
    }
    const result = await mod.run(ctx);
    const status = String(result && result.status ? result.status : "FAIL").toUpperCase();
    return {
      name: key,
      status: ["PASS", "FAIL", "SKIP"].includes(status) ? status : "FAIL",
      reason: result && result.reason ? String(result.reason) : "",
      checks: Array.isArray(result && result.checks) ? result.checks : [],
      evidence: result && result.evidence ? result.evidence : null,
    };
  } catch (e) {
    return { name: key, status: "FAIL", reason: e instanceof Error ? e.message : String(e), checks: [] };
  }
}

function printHuman(result) {
  const label = result.name.toUpperCase();
  for (const check of result.checks) {
    if (!check.ok) console.error("  [FAIL] " + check.name + (check.detail ? " :: " + check.detail : ""));
  }
  if (result.status !== "PASS") {
    if (result.reason) console.error("  reason: " + result.reason);
    const passed = result.checks.filter((c) => c.ok).length;
    console.error("  checks: " + passed + "/" + result.checks.length + " passed");
  }
  if (result.evidence) console.error("  evidence: " + JSON.stringify(result.evidence));
  console.log("DRILL_" + label + "=" + result.status);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error("[drill] " + parsed.error);
    usage();
    process.exitCode = 2;
    return;
  }
  const opts = parsed.opts;
  if (opts.help) {
    usage();
    return;
  }

  const selected = opts.only ? DRILL_KEYS.filter((k) => opts.only.includes(k)) : DRILL_KEYS.slice();
  const bash = detectBash();
  const startedAt = Date.now();
  const results = [];

  if (!opts.json) {
    console.error("[drill] 开始：" + selected.join(", ") + "（platform=" + process.platform + ", bash=" + (bash || "未找到") + ", full=" + opts.full + "）");
  }

  for (const key of selected) {
    if (!opts.json) banner(key, "开始演练");
    const result = await runOne(key, { root: ROOT, full: opts.full, bash, isWindows: IS_WINDOWS });
    results.push(result);
    if (!opts.json) printHuman(result);
  }

  const ok = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  const exitCode = fail > 0 ? 1 : 0;

  if (opts.json) {
    const payload = {
      source: "learn-workbench/drill",
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      platform: process.platform,
      bash: bash || null,
      full: opts.full,
      ok: fail === 0,
      summary: { passed: ok, failed: fail, skipped: skip },
      drills: results,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("DRILL_SUMMARY ok=" + ok + " fail=" + fail + " skip=" + skip + " exit=" + exitCode);
  }
  process.exitCode = exitCode;
}

main().catch((e) => {
  console.error("[drill] 执行失败：" + (e instanceof Error ? (e.stack || e.message) : String(e)));
  console.log("DRILL_SUMMARY ok=0 fail=1 skip=0 exit=1");
  process.exitCode = 1;
});
