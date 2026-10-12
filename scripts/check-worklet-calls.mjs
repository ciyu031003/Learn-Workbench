#!/usr/bin/env node
/**
 * worklet 调用护栏（v1.44.1 新增）。
 *
 * ## 为什么需要
 * 这是本项目**第三次**被 worklet 规则坑到真机闪退（见看板踩坑 71 / 78 / 79）：
 * useAnimatedStyle / useDerivedValue / 手势回调里的代码跑在 **UI 线程**，那里只有 worklet。
 * 调用一个普通 JS 函数会抛
 *   "Tried to synchronously call a non-worklet function on the UI thread"
 * 在 release 包上的表现是**界面还没画出来就闪退**，dev 模式有时还不报。
 *
 * v1.44.0 把庆祝特效的粒子数学从组件抽到 lib/celebration-particles.ts 时漏写
 * "worklet" 指令，直接导致「每日任务打勾」与「题库做完一章」两条路径双双闪退。
 * 类型检查与单测都发现不了，只有真机才暴露 —— 所以加这条静态检查。
 *
 * ## 判定口径（只报"确定的"问题，不猜）
 * 对每个 worklet 体收集**被调用**的标识符；只有当该标识符是**从本仓库其它模块
 * import 进来**（@/... 或相对路径）且那个导出**没有 "worklet" 指令**时才判违规。
 *
 * 因此不会误报：Math/console 等全局；从 react-native-reanimated 等 node_modules
 * 导入的（withTiming/Easing）；本文件内定义的函数（babel 插件会自动 worklet 化）；
 * 被 worklet 读到的常量（不是"调用"）。
 *
 * 用法：node scripts/check-worklet-calls.mjs          # 校验（CI / 本地）
 *       node scripts/check-worklet-calls.mjs --list    # 打印 worklet 调用点数量
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "apps", "mobile", "src");
const LIST = process.argv.includes("--list");

/** worklet 上下文：这些调用后面跟的函数体会跑在 UI 线程 */
const WORKLET_CALLS = [
  "useAnimatedStyle", "useAnimatedProps", "useDerivedValue", "useAnimatedReaction",
  "onBegin", "onUpdate", "onEnd", "onStart", "onFinalize",
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** 从 open 处的括号开始做配对，返回括号之间（不含括号）的内容 */
function balanced(src, openIdx) {
  const open = src[openIdx];
  const close = open === "(" ? ")" : open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i += 1) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") i += 1;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && src[i + 1] === "/") { const n = src.indexOf("\n", i); i = n === -1 ? src.length : n; continue; }
    if (c === "/" && src[i + 1] === "*") { const n = src.indexOf("*/", i); i = n === -1 ? src.length : n + 1; continue; }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return src.slice(openIdx + 1);
}

/** localName -> { file, imported }：只收本仓库内的 import */
function localImports(src, file) {
  const map = new Map();
  const re = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[2];
    if (!spec.startsWith("@/") && !spec.startsWith(".")) continue;
    const target = spec.startsWith("@/")
      ? path.join(SRC, spec.slice(2))
      : path.resolve(path.dirname(file), spec);
    const named = /\{([\s\S]*?)\}/.exec(m[1]);
    if (!named) continue;
    for (const part of named[1].split(",")) {
      const t = part.trim().replace(/^type\s+/, "");
      if (!t) continue;
      const bits = t.split(/\s+as\s+/).map((x) => x.trim());
      map.set(bits[1] || bits[0], { file: target, imported: bits[0] });
    }
  }
  return map;
}

/** 模块导出：导出名 -> { file, hasWorklet } */
function exportsWithWorklet(file) {
  const out = new Map();
  const cands = [file + ".ts", file + ".tsx", path.join(file, "index.ts"), path.join(file, "index.tsx")];
  let actual = null;
  for (const c of cands) {
    try { if (statSync(c).isFile()) { actual = c; break; } } catch { /* keep looking */ }
  }
  if (!actual) return out;
  const src = readFileSync(actual, "utf8");
  const re = /export\s+(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\())/g;
  const starts = [];
  let m;
  while ((m = re.exec(src))) {
    const name = m[1] || m[2];
    if (name) starts.push({ name, at: m.index });
  }
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : src.length;
    const span = src.slice(s.at, end);
    /**
     * 不要用「函数名后第一个 {」去找函数体：TS 的返回类型注解本身就可能是
     * `): { x: number } {` —— 第一个 { 属于**类型**而不是函数体，之前的实现因此
     * 把已加指令的函数误判为违规。
     * 改成块级判定：某个 { 之后只有空白/注释、紧跟 "worklet" 即视为指令。
     */
    const hasWorklet = /\{[\s]*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*["']worklet["']/.test(span);
    out.set(s.name, { file: actual, hasWorklet });
  });
  return out;
}

const files = walk(SRC);
const cache = new Map();
const violations = [];
let sites = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!WORKLET_CALLS.some((c) => src.includes(c))) continue;
  const imports = localImports(src, file);
  if (imports.size === 0) continue;

  for (const call of WORKLET_CALLS) {
    const re = new RegExp("\\b" + call + "\\s*\\(", "g");
    let m;
    while ((m = re.exec(src))) {
      const openIdx = src.indexOf("(", m.index);
      const body = balanced(src, openIdx);
      sites += 1;
      const called = new Set();
      const cre = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
      let cm;
      while ((cm = cre.exec(body))) called.add(cm[1]);
      for (const name of called) {
        const imp = imports.get(name);
        if (!imp) continue;
        if (!cache.has(imp.file)) cache.set(imp.file, exportsWithWorklet(imp.file));
        const exp = cache.get(imp.file).get(imp.imported);
        if (!exp) continue;
        if (!exp.hasWorklet) {
          const line = src.slice(0, m.index).split("\n").length;
          violations.push({ file: path.relative(ROOT, file).split(path.sep).join("/"), line, call, name, target: path.relative(ROOT, exp.file).split(path.sep).join("/") });
        }
      }
    }
  }
}

if (LIST) console.log("[worklet] worklet 调用点 " + sites + " 个");

if (violations.length) {
  console.error("[worklet] worklet 里调用了没有 worklet 指令的模块函数（真机会闪退）：");
  for (const v of violations) {
    console.error("  - " + v.file + ":" + v.line + "  " + v.call + "(...) 内调用了 " + v.name + "()");
    console.error("      → " + v.target + " 里给 " + v.name + " 首行加 \"worklet\"; 指令");
  }
  console.error("  背景：见 apps/mobile/CLAUDE.md「手势与 worklet（硬约束）」。");
  process.exit(1);
}

console.log("[worklet] 通过：worklet 调用点 " + sites + " 个，无跨模块普通函数调用");
