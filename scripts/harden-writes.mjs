/* eslint-disable */
/**
 * 给写接口处理器加统一错误边界（2026-09-15 加固）
 *
 * 目标：`export async function POST/PUT/PATCH/DELETE` 的**函数体**包一层 try/catch，
 * 捕获时返回 `dbErrorResponse(e)`（约束冲突 → 4xx；其余 → 结构化 500）。
 *
 * 安全约束（脚本必须可复核）：
 *  - 只处理显式列出的 (文件, 函数名)，不做全局猜测；
 *  - 用**函数名 + 参数行**定位起点、用「该函数之后第一个列 0 的 `}`」定位终点；
 *  - 已含 try/catch 的跳过多余包裹（幂等：再次运行不会二次包裹）；
 *  - 逐文件打印命中情况，dry-run 可先看 diff 概览。
 *
 * 用法：node scripts/harden-writes.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "F:/CodeFiles/Learn-Workbench/apps/web/app/api";
const dry = process.argv.includes("--dry");

const TARGETS = [
  ["nutrition/route.ts", ["POST"]],
  ["nutrition/target/route.ts", ["PUT"]],
  ["nutrition/foods/route.ts", ["POST"]],
  ["wellbeing/weight/route.ts", ["POST"]],
  ["wellbeing/hydration/route.ts", ["POST"]],
  ["habits/route.ts", ["POST"]],
  ["habits/[id]/route.ts", ["PATCH"]],
  ["habits/logs/route.ts", ["POST"]],
  ["logs/route.ts", ["POST"]],
  ["tasks/route.ts", ["POST", "PATCH"]],
  ["checkin/route.ts", ["POST"]],
  ["progress/route.ts", ["POST"]],
  ["focus/route.ts", ["POST"]],
  ["trackers/route.ts", ["POST"]],
  ["workouts/route.ts", ["POST"]],
  ["certificates/route.ts", ["POST"]],
];

const CATCH = `  } catch (e) {
    return dbErrorResponse(e);
  }`;

let changed = 0;
const log = [];

for (const [rel, fns] of TARGETS) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, "utf8");
  const before = src;

  for (const fn of fns) {
    const lines = src.split("\n");
    // 定位函数声明
    const startIdx = lines.findIndex((l) => l.startsWith(`export async function ${fn}(`));
    if (startIdx < 0) {
      log.push(`MISS   ${rel} ${fn}（找不到声明）`);
      continue;
    }
    // 函数体首行 = 声明行之后第一行
    const bodyFirst = startIdx + 1;
    // 找到该函数结束（之后第一个列 0 的 `}`）——注意 CRLF 文件的行尾会带 \r
    let endIdx = -1;
    for (let i = bodyFirst; i < lines.length; i++) {
      if (lines[i].replace(/\r$/, "") === "}") {
        endIdx = i;
        break;
      }
    }
    if (endIdx < 0) {
      log.push(`MISS   ${rel} ${fn}（找不到结束括号）`);
      continue;
    }
    // 幂等：函数体里已有 dbErrorResponse 就跳过
    const bodyText = lines.slice(bodyFirst, endIdx).join("\n");
    if (bodyText.includes("dbErrorResponse(")) {
      log.push(`SKIP   ${rel} ${fn}（已包裹）`);
      continue;
    }
    // 在函数体首行前插入 `  try {`，把结束 `}` 换成 catch + `}`
    const out = [
      ...lines.slice(0, bodyFirst),
      "  try {",
      ...lines.slice(bodyFirst, endIdx),
      CATCH,
      "}",
      ...lines.slice(endIdx + 1),
    ];
    src = out.join("\n");
    log.push(`WRAP   ${rel} ${fn}`);
  }

  // 补 import
  if (src !== before && !src.includes("dbErrorResponse")) {
    log.push(`WARN   ${rel}（已包裹但未引用 dbErrorResponse？）`);
  }
  if (src.includes("dbErrorResponse(e)") && !src.includes('from "@/lib/http"')) {
    const idx = src.indexOf("\n");
    src = src.slice(0, idx + 1) + 'import { dbErrorResponse } from "@/lib/http";\n' + src.slice(idx + 1);
    log.push(`IMPORT ${rel}`);
  } else if (src.includes("dbErrorResponse(e)")) {
    src = src.replace(/import \{([^}]*)\} from "@\/lib\/http";/, (m, names) => {
      if (names.includes("dbErrorResponse")) return m;
      return `import {${names.trimEnd()}, dbErrorResponse } from "@/lib/http";`;
    });
  }

  if (src !== before) {
    if (!dry) fs.writeFileSync(file, src, "utf8");
    changed++;
  }
}

console.log(log.join("\n"));
console.log(`\n${dry ? "[dry-run] " : ""}修改文件数：${changed}`);
