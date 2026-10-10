#!/usr/bin/env node
/**
 * 动效预算护栏（组一 · 阶段 3）。
 *
 * 背景：`减弱动态` 已覆盖（`lib/motion.ts` 的 `useReducedMotion` + `theme/motion.ts` 的
 * `isMotionActive`），但**动画总量本身没有预算**——新页面随手加 `withSpring/withTiming`
 * 不会有任何提示，低端机上表现为掉帧，且这类回归在代码评审里几乎看不出来。
 *
 * 三条规则：
 *  R1 动效点数量 ratchet：每个文件的 `withSpring|withTiming|withRepeat|withSequence|withDelay`
 *     处数不许**增加**（要加就必须删/合并，或在 PR 里刷新基线并说明理由）。
 *  R2 持续动画必须有可见性/无障碍开关：用 `withRepeat` 的文件必须引用 `useReducedMotion`
 *     或 `isMotionActive`，否则登记到 `continuousExceptions`（信息型加载脉冲、纯装饰底纹）。
 *  R3 记录基线数字：动效点总数、`useAnimatedStyle` 文件数、`withRepeat` 文件数（写入基线，
 *     供"低端机帧率基线"章节引用）。
 *
 * 用法：
 *   node scripts/check-motion-budget.mjs            # 校验（CI / 提交前）
 *   node scripts/check-motion-budget.mjs --update   # 刷新基线（PR 里说明理由）
 *   node scripts/check-motion-budget.mjs --report   # 只打印统计，不校验
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "apps/mobile/src");
const BASELINE = path.join(ROOT, "docs/motion-budget-baseline.json");
const ANIM = /with(Spring|Timing|Repeat|Sequence|Delay)\b/g;
const GATE = /useReducedMotion|isMotionActive/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");

const files = walk(SRC);
const sites = {};
const ungatedRepeat = [];
let animatedStyleFiles = 0;
let repeatFiles = 0;

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const n = (src.match(ANIM) ?? []).length;
  if (n > 0) sites[rel(f)] = n;
  if (src.includes("useAnimatedStyle")) animatedStyleFiles += 1;
  if (/\bwithRepeat\b/.test(src)) {
    repeatFiles += 1;
    if (!GATE.test(src)) ungatedRepeat.push(rel(f));
  }
}

const total = Object.values(sites).reduce((a, b) => a + b, 0);
const current = {
  totals: { animationSites: total, animatedStyleFiles, repeatFiles, filesWithAnimations: Object.keys(sites).length },
  sites: Object.fromEntries(Object.entries(sites).sort(([a], [b]) => a.localeCompare(b))),
  continuousExceptions: ungatedRepeat.sort(),
};

if (process.argv.includes("--report")) {
  console.log(JSON.stringify(current.totals, null, 2));
  console.log("未登记的无障碍开关持续动画文件：" + (ungatedRepeat.join(", ") || "无"));
  process.exit(0);
}

if (process.argv.includes("--update") || !fs.existsSync(BASELINE)) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n", "utf8");
  console.log(
    `[motion] 基线已写入 ${rel(BASELINE)}：动效点 ${total} 处 / ${Object.keys(sites).length} 文件；` +
      `useAnimatedStyle ${animatedStyleFiles} 文件；withRepeat ${repeatFiles} 文件；持续动画例外 ${ungatedRepeat.length} 个`
  );
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
const problems = [];

const grown = [];
for (const [f, n] of Object.entries(current.sites)) {
  const allowed = base.sites?.[f] ?? 0;
  if (n > allowed) grown.push(`${f}: ${allowed} → ${n}`);
}
if (grown.length) {
  problems.push("R1 动效点预算超支（新增动效请合并/删除，或刷新基线并说明）：\n  - " + grown.join("\n  - "));
}

const allowedExceptions = new Set(base.continuousExceptions ?? []);
const newRepeatOffenders = ungatedRepeat.filter((f) => !allowedExceptions.has(f));
if (newRepeatOffenders.length) {
  problems.push(
    "R2 持续动画缺可见性/无障碍开关（withRepeat 必须走 useReducedMotion 或 isMotionActive）：\n  - " +
      newRepeatOffenders.join("\n  - ")
  );
}

const pins = [];
for (const needed of ["apps/mobile/src/lib/motion.ts", "apps/mobile/src/theme/motion.ts"]) {
  const p = path.join(ROOT, needed);
  if (!fs.existsSync(p)) pins.push(`${needed} 不存在（减弱动态的唯一出口）`);
}
if (pins.length) problems.push("R3 减弱动态出口缺失：\n  - " + pins.join("\n  - "));

if (problems.length) {
  for (const p of problems) console.error("[motion] " + p);
  console.error("[motion] 失败：动效预算护栏未通过");
  process.exitCode = 1;
} else {
  const improved = Object.entries(current.sites).filter(([f, n]) => n < (base.sites?.[f] ?? 0));
  console.log(
    `[motion] 通过：动效点 ${total} 处 / ${Object.keys(current.sites).length} 文件；` +
      `useAnimatedStyle ${animatedStyleFiles} 文件；withRepeat ${repeatFiles} 文件；持续动画例外 ${ungatedRepeat.length} 个`
  );
  if (improved.length) {
    console.log("[motion] 动效点下降（建议 --update 收紧基线）：" + improved.map(([f, n]) => f + "=" + n).join(", "));
  }
}
