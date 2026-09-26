/**
 * 字阶护栏（ratchet）：`app/**` 里裸写的数字 fontSize 不许**增加**。
 *
 * 为什么不用 eslint no-restricted-syntax：
 *   实测收敛两轮后仍有 208 处数字字号，但它们**全都是刻意保留的例外**
 *   （图标/图形尺寸、KPI 大数字、≤13pt 的徽标与图表刻度）。
 *   一刀切规则会让 eslint 立刻 208 error，等于把"护栏"变成"阻塞"；
 *   而逐处 disable 会淹没真正的新增违规。
 * 做法：把当前每文件处数固化成基线，任何**超过基线**的改动直接失败。
 *
 * 用法：
 *   node scripts/check-font-scale.mjs            # 校验（CI / 提交前）
 *   node scripts/check-font-scale.mjs --update   # 有意新增例外时刷新基线（需在 PR 里说明理由）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_DIR = path.join(ROOT, "apps/mobile/src/app");
const BASELINE = path.join(ROOT, "docs/font-scale-baseline.json");
const PATTERN = /fontSize:\s*[0-9]+(?:\.[0-9]+)?/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function count() {
  const rows = {};
  for (const f of walk(APP_DIR)) {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    const n = (fs.readFileSync(f, "utf8").match(PATTERN) ?? []).length;
    if (n > 0) rows[rel] = n;
  }
  return rows;
}

const current = count();
const update = process.argv.includes("--update");

if (update || !fs.existsSync(BASELINE)) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n", "utf8");
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log("[fontscale] 基线已写入 " + path.relative(ROOT, BASELINE) + "： " + Object.keys(current).length + " 文件 / " + total + " 处");
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
const grown = [];
for (const [f, n] of Object.entries(current)) {
  const allowed = base[f] ?? 0;
  if (n > allowed) grown.push({ f, n, allowed });
}
const shrunk = Object.entries(base).filter(([f, n]) => (current[f] ?? 0) < n);

if (grown.length > 0) {
  console.error("[fontscale] 失败：以下文件裸写数字 fontSize 超过基线（新增字阶必须走 typography token）：");
  for (const g of grown) console.error("  " + g.f + "：" + g.allowed + " → " + g.n);
  console.error("\n若确属例外（图形/KPI/徽标），请用 node scripts/check-font-scale.mjs --update 刷新基线并在提交信息里说明理由。");
  process.exit(1);
}

const total = Object.values(current).reduce((a, b) => a + b, 0);
console.log("[fontscale] 通过：裸写数字 fontSize 未增加（共 " + total + " 处 / " + Object.keys(current).length + " 文件，均为已登记的例外）");
if (shrunk.length > 0) {
  console.log("[fontscale] 提示：" + shrunk.length + " 个文件已低于基线，可跑 --update 收紧基线：" + shrunk.map(([f]) => f).join(", "));
}
