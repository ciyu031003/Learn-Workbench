#!/usr/bin/env node
/**
 * 图标尺寸令牌护栏（skill P6：图标尺寸必须成体系，不许散落任意值）。
 *
 * 背景：Web 端图标尺寸一度出现 2.5 / 3 / 3.5 / 4 / 4.5 / 5 / 6 / 7 / 8 / 10 / 24 共 11 种写法，
 * 同一视觉层级里混用会明显降低精致感。这里收敛为 4 个语义档（globals.css 的 --icon-*）：
 *   .icon-xs(14)  .icon-sm(16)  .icon-md(20)  .icon-lg(24)
 * 存量允许 3.5 / 4 / 5 / 6（与令牌一一对应），其余一律报错。
 *
 * 用法：
 *   node scripts/check-icon-scale.mjs           # 检查（有问题 exit 1）
 *   node scripts/check-icon-scale.mjs --list     # 打印全部用法计数
 *
 * 例外：某行确需非标尺寸时，在该行或上一行写注释 icon-scale-ok 说明原因。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = [path.join(ROOT, "apps", "web", "components"), path.join(ROOT, "apps", "web", "app")];
const ALLOWED = new Set(["3", "3.5", "4", "5", "6"]);
const TOKEN_CLASSES = /\bicon-(xs|sm|md|lg)\b/;

function walk(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (["node_modules", ".next", "dist"].includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((dir) => walk(dir));
const violations = [];
const counts = new Map();

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    const match = line.match(/<[A-Z]\w*[^>]*className="[^"]*\bsize-([\d.]+)[^"]*"/);
    if (!match) return;
    const size = match[1];
    counts.set(size, (counts.get(size) ?? 0) + 1);
    if (ALLOWED.has(size) || TOKEN_CLASSES.test(line)) return;
    const prev = lines[index - 1] ?? "";
    if (line.includes("icon-scale-ok") || prev.includes("icon-scale-ok")) return;
    violations.push(path.relative(ROOT, file).split(path.sep).join("/") + ":" + (index + 1) + "  size-" + size);
  });
}

if (process.argv.includes("--list")) {
  console.log("[icon-scale] 用法分布：");
  for (const [size, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log("  size-" + size + "  x" + n);
  process.exit(0);
}

if (violations.length > 0) {
  console.error("[icon-scale] 发现非令牌图标尺寸（改用 .icon-2xs/xs/sm/md/lg，或确认后加 icon-scale-ok 注释）：");
  for (const item of violations) console.error("  " + item);
  console.error("[icon-scale] 共 " + violations.length + " 处；允许：size-3 / size-3.5 / size-4 / size-5 / size-6");
  process.exitCode = 1;
} else {
  console.log("[icon-scale] 通过：图标尺寸均在令牌体系内 ✅");
}
