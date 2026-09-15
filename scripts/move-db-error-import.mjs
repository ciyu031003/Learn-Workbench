/* eslint-disable */
/**
 * 把已包裹写接口的 `dbErrorResponse` 来源从 `@/lib/http` 迁到 `@/lib/api-error`
 * （原因：`@/lib/http` 在多个 route 测试里被部分 mock，放那里会拿到 undefined）。
 *
 * 用法：node scripts/move-db-error-import.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "F:/CodeFiles/Learn-Workbench/apps/web/app/api";
const dry = process.argv.includes("--dry");
const NEW_IMPORT = 'import { dbErrorResponse } from "@/lib/api-error";';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

const log = [];
let changed = 0;

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("dbErrorResponse(")) continue;
  const before = src;

  // 1) 从 @/lib/http 的 import 里去掉 dbErrorResponse
  src = src.replace(/import \{([^}]*)\} from "@\/lib\/http";/, (m, names) => {
    const kept = names
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n) => n !== "dbErrorResponse");
    if (kept.length === 0) return "/* @/lib/http 已无引用 */";
    return `import { ${kept.join(", ")} } from "@/lib/http";`;
  });

  // 2) 补 api-error 的 import（放在第一行之后）
  if (!src.includes('from "@/lib/api-error"')) {
    const idx = src.indexOf("\n");
    src = src.slice(0, idx + 1) + NEW_IMPORT + "\n" + src.slice(idx + 1);
  }

  if (src !== before) {
    if (!dry) fs.writeFileSync(file, src, "utf8");
    changed++;
    log.push(`MOVE  ${file.replace(ROOT, "")}`);
  }
}

console.log(log.join("\n"));
console.log(`\n${dry ? "[dry-run] " : ""}修改文件数：${changed}`);
