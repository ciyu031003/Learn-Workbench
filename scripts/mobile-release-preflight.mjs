#!/usr/bin/env node
/**
 * 移动端发布前置门禁（P6 · 方案 §7.5「每版必过 8 项」的自动化部分）。
 *
 * 为什么需要：发版前要跑的东西分散在 5 个脚本 + 2 条 pnpm 命令里，靠人记就会漏。
 * 这里一条命令跑完自动化部分，并把**必须由人在真机上完成的 8 项**打印成清单。
 *
 * 用法：
 *   node scripts/mobile-release-preflight.mjs            # 跑全部自动化检查 + 打印真机清单
 *   node scripts/mobile-release-preflight.mjs --manual   # 只打印真机清单（发版现场用）
 *   node scripts/mobile-release-preflight.mjs --skip-tests  # 跳过 vitest（本地已跑过时）
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const manualOnly = args.includes("--manual");
const skipTests = args.includes("--skip-tests");

const CHECKS = [
  { name: "mobile typecheck", cmd: "pnpm", args: ["-F", "mobile", "typecheck"], skip: false },
  { name: "mobile vitest", cmd: "pnpm", args: ["-F", "mobile", "test"], skip: skipTests },
  { name: "font-scale（含 *styles.ts）", cmd: "node", args: ["scripts/check-font-scale.mjs"] },
  { name: "ui-matrix（hitSlop / tab 安全区）", cmd: "node", args: ["scripts/check-mobile-ui-matrix.mjs"] },
  { name: "motion-budget（动效预算）", cmd: "node", args: ["scripts/check-motion-budget.mjs"] },
  { name: "worklet-calls（worklet 硬约束）", cmd: "node", args: ["scripts/check-worklet-calls.mjs"] },
  { name: "release-hygiene（版本号 / 远端）", cmd: "node", args: ["scripts/check-release-hygiene.mjs"] },
  { name: "mobile-sync-matrix（同步能力矩阵）", cmd: "node", args: ["scripts/mobile-sync-matrix.mjs"] },
];

const MANUAL = [
  "安装 release 包 → 冷启动：确认启动屏底色与首页画布一致（无跳色）",
  "登录 → 今日页勾一条任务：出现「已保存 N 条待同步」轻条（断网时）/ 直接归零（联网时）",
  "开始专注 → 退到后台 5 分钟 → 回前台：计时按系统时间延续，不是从 0 开始",
  "断网改一条记录 → 联网：设置页「数据同步」待同步队列 ≤60s 内归零，分通道文案正确",
  "学习页阶段卡片拖拽（release 包）：按下 / 拖动 / 松手 / 取消 四条路径都不闪退",
  "职业页「把差距生成学习任务」：toast 报「已生成 N 个学习任务」，今日任务能看到新任务",
  "成长页：本周概览四格有数、今日习惯显示 X/Y，健康记录里的睡眠/饮食入口可达",
  "5 个 Tab 浅色/深色截图（三档宽度）：对照方案 §9 六维评分，核心页 ≥85 才发版",
];

function run(check) {
  const started = Date.now();
  const res = spawnSync(check.cmd, check.args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = (res.stdout ?? "") + (res.stderr ?? "");
  const tail = output.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? "";
  return { ok: res.status === 0, ms: Date.now() - started, tail };
}

function printManual() {
  console.log("\n真机验收 8 项（自动化无法覆盖，必须人工点一遍）：");
  MANUAL.forEach((item, i) => console.log("  " + (i + 1) + ". " + item));
  console.log("\n证据要求：真机截图（浅/深 × 三档宽度）+ 关键交互录屏 + 本脚本输出。");
}

if (manualOnly) {
  printManual();
  process.exit(0);
}

console.log("== 移动端发布前置门禁 ==");
let failed = 0;
for (const check of CHECKS) {
  if (check.skip) {
    console.log("  SKIP  " + check.name);
    continue;
  }
  const r = run(check);
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed += 1;
  console.log("  " + mark + "  " + check.name + "  (" + (r.ms / 1000).toFixed(1) + "s)");
  if (!r.ok && r.tail) console.log("        " + r.tail.replace(/\x1b\[[0-9;]*m/g, ""));
}

printManual();
if (failed > 0) {
  console.log("\n结果：FAIL（" + failed + " 项未通过，禁止发版）");
  process.exit(1);
}
console.log("\n结果：PASS（自动化门禁全绿；完成后请按上面 8 项做真机验收再发版）");
