#!/usr/bin/env node
/**
 * 移动端真机矩阵护栏（组一 · 阶段 2）。
 *
 * 与 `check-font-scale.mjs` 同一套思路：**不发明脆弱的一刀切规则**，而是把"当前已达成的
 * 覆盖"固化成基线，任何回落直接失败；再加几条确定性的显式钉桩。
 *
 * 覆盖三类真机问题：
 *  R1 触控热区（44pt）：每个文件的 `hitSlop` 覆盖数不许减少 —— 新增图标按钮时必须带热区。
 *  R2 显式钉桩：共享小组件（BottomSheet 关闭钮、Button/PressButton 尺寸档）必须带热区手段。
 *  R3 安全区/TabBar：`(tabs)/**` 里渲染滚动内容的页面必须走 `useTabBarSpace()`（例外登记在基线）。
 *
 * 用法：
 *   node scripts/check-mobile-ui-matrix.mjs            # 校验（CI / 提交前）
 *   node scripts/check-mobile-ui-matrix.mjs --update   # 有意调整时刷新基线（PR 里说明理由）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MOBILE = path.join(ROOT, "apps/mobile/src");
const BASELINE = path.join(ROOT, "docs/mobile-ui-matrix-baseline.json");
const HITSLOP_PATTERN = /\bhitSlop\b/g;
const SCROLL_PATTERN = /<(ScrollView|FlatList|FlashList)\b/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");

/** R1：每文件 hitSlop 处数 */
function countHitSlop() {
  const rows = {};
  for (const dir of [path.join(MOBILE, "app"), path.join(MOBILE, "components")]) {
    for (const f of walk(dir)) {
      const n = (fs.readFileSync(f, "utf8").match(HITSLOP_PATTERN) ?? []).length;
      if (n > 0) rows[rel(f)] = n;
    }
  }
  return rows;
}

/** R3：tab 页里渲染滚动内容却没走 useTabBarSpace 的文件 */
function tabBarOffenders() {
  const dir = path.join(MOBILE, "app/(tabs)");
  if (!fs.existsSync(dir)) return [];
  return walk(dir)
    .filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return SCROLL_PATTERN.test(src) && !src.includes("useTabBarSpace");
    })
    .map(rel)
    .sort();
}

/** R2：显式钉桩（共享小组件的热区手段） */
const PINS = [
  {
    file: "apps/mobile/src/lib/button-spec.ts",
    must: /MIN_TOUCH_TARGET\s*=\s*44/,
    why: "触控下限 44pt 必须是唯一出口",
  },
  {
    file: "apps/mobile/src/components/button.tsx",
    must: /buttonHitSlop\(size\)/,
    why: "Button 的 sm 档（高 38）必须用 hitSlop 补足 44",
  },
  {
    file: "apps/mobile/src/components/press-button.tsx",
    must: /buttonHitSlop\(size\)/,
    why: "PressButton 的 sm 档（高 38）必须用 hitSlop 补足 44",
  },
  {
    file: "apps/mobile/src/components/bottom-sheet.tsx",
    must: /hitSlop=/,
    why: "BottomSheet 关闭钮是 28×28，必须带热区",
  },
];

function pinFailures() {
  const fails = [];
  for (const pin of PINS) {
    const p = path.join(ROOT, pin.file);
    if (!fs.existsSync(p)) {
      fails.push(`${pin.file} 不存在（${pin.why}）`);
      continue;
    }
    if (!pin.must.test(fs.readFileSync(p, "utf8"))) {
      fails.push(`${pin.file} 缺少 ${pin.must}（${pin.why}）`);
    }
  }
  return fails;
}

const update = process.argv.includes("--update");
const current = { hitSlop: countHitSlop(), tabBarExceptions: tabBarOffenders() };

if (update || !fs.existsSync(BASELINE)) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n", "utf8");
  const total = Object.values(current.hitSlop).reduce((a, b) => a + b, 0);
  console.log(
    `[ui-matrix] 基线已写入 ${rel(BASELINE)}：hitSlop ${Object.keys(current.hitSlop).length} 文件 / ${total} 处；` +
      `tab 页安全区例外 ${current.tabBarExceptions.length} 个`
  );
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
const problems = [];

const regressed = [];
for (const [f, n] of Object.entries(base.hitSlop ?? {})) {
  const now = current.hitSlop[f] ?? 0;
  if (now < n) regressed.push(`${f}: ${n} → ${now}`);
}
if (regressed.length) {
  problems.push("R1 触控热区覆盖回落（新增图标按钮请补 hitSlop）：\n  - " + regressed.join("\n  - "));
}

const allowed = new Set(base.tabBarExceptions ?? []);
const newOffenders = current.tabBarExceptions.filter((f) => !allowed.has(f));
if (newOffenders.length) {
  problems.push("R3 tab 页缺安全区处理（滚动内容必须 useTabBarSpace）：\n  - " + newOffenders.join("\n  - "));
}

const pins = pinFailures();
if (pins.length) {
  problems.push("R2 共享组件热区钉桩失败：\n  - " + pins.join("\n  - "));
}

if (problems.length) {
  for (const p of problems) console.error("[ui-matrix] " + p);
  console.error("[ui-matrix] 失败：真机矩阵护栏未通过");
  process.exitCode = 1;
} else {
  const total = Object.values(current.hitSlop).reduce((a, b) => a + b, 0);
  const improved = Object.entries(current.hitSlop).filter(([f, n]) => n > (base.hitSlop?.[f] ?? 0));
  console.log(
    `[ui-matrix] 通过：hitSlop ${Object.keys(current.hitSlop).length} 文件 / ${total} 处；` +
      `tab 页安全区例外 ${current.tabBarExceptions.length} 个；钉桩 ${PINS.length} 条`
  );
  if (improved.length) {
    console.log("[ui-matrix] 覆盖提升（建议 --update 收紧基线）：" + improved.map(([f, n]) => f + "=" + n).join(", "));
  }
}
