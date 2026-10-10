#!/usr/bin/env node
/**
 * 生成 `content-platform/db/index-inventory.md`（组三 · H1 数据工程严谨性工件）。
 *
 * 为什么从 DDL 文本解析而不是查库：
 *  - 工件要能进 CI，不依赖本地/远端 Postgres；
 *  - "库里有索引、文档没写" 与 "文档写了、库没建" 同样是漂移，从唯一事实源
 *    （`db/schema.sql` + `db/migrations/*.sql`）推导才能和迁移保持一致。
 *
 * 用法：
 *   node scripts/db-index-inventory.mjs          # 写入工件
 *   node scripts/db-index-inventory.mjs --check  # 只比对，不写入（CI 门禁：漂移即失败）
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "content-platform", "db", "index-inventory.md");
const CHECK = process.argv.includes("--check");

const AUDIT_COLUMNS = ["created_at", "updated_at", "created_by", "updated_by"];
const SOFT_DELETE_COLUMN = "deleted_at";
const LOCK_COLUMN = "version";

function readDdl() {
  const parts = [];
  const schemaFile = path.join(ROOT, "db", "schema.sql");
  if (existsSync(schemaFile)) parts.push(readFileSync(schemaFile, "utf8"));
  const migDir = path.join(ROOT, "db", "migrations");
  const files = existsSync(migDir) ? readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort() : [];
  for (const f of files) parts.push(readFileSync(path.join(migDir, f), "utf8"));
  return parts.join("\n");
}

/** 从 `(` 起找配对的 `)`（忽略单引号字符串与 $$ 体）。 */
function matchParens(text, openIndex) {
  let depth = 0;
  let inQuote = false;
  let inDollar = false;
  for (let i = openIndex; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (!inQuote && two === "$$") {
      inDollar = !inDollar;
      i++;
      continue;
    }
    if (inDollar) continue;
    const ch = text[i];
    if (ch === "'") inQuote = !inQuote;
    if (inQuote) continue;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return text.slice(openIndex + 1);
}

const TABLE_CONSTRAINT = /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i;

function parseDdl(ddl) {
  const tables = new Map();
  const ensure = (name) => {
    if (!tables.has(name)) tables.set(name, { columns: new Set(), indexes: [], constraints: [] });
    return tables.get(name);
  };

  // CREATE TABLE
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s*\(/gi;
  for (const m of ddl.matchAll(createRe)) {
    const name = m[1].toLowerCase();
    const body = matchParens(ddl, m.index + m[0].length - 1);
    const table = ensure(name);
    for (const rawLine of body.split(/\n/)) {
      const line = rawLine.trim().replace(/,\s*$/, "");
      if (!line || line.startsWith("--")) continue;
      if (TABLE_CONSTRAINT.test(line)) {
        table.constraints.push(line.replace(/\s+/g, " "));
        continue;
      }
      const col = /^([a-z_][a-z0-9_]*)\s+/.exec(line)?.[1];
      if (col) table.columns.add(col.toLowerCase());
    }
  }

  // ALTER TABLE ... ADD COLUMN
  const addColRe = /ALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)/gi;
  for (const m of ddl.matchAll(addColRe)) {
    ensure(m[1].toLowerCase()).columns.add(m[2].toLowerCase());
  }

  // ALTER TABLE ... ADD CONSTRAINT
  const addConRe = /ALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s+ADD\s+CONSTRAINT\s+([a-z0-9_]+)\s+((?:CHECK|UNIQUE|PRIMARY\s+KEY|FOREIGN\s+KEY)[^;]*)/gi;
  for (const m of ddl.matchAll(addConRe)) {
    ensure(m[1].toLowerCase()).constraints.push(`${m[2]} ${m[3].replace(/\s+/g, " ").trim()}`);
  }

  // CREATE INDEX
  const idxRe = /CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z0-9_]+)\s+ON\s+([a-z_][a-z0-9_]*)\s*\(([^)]*)\)([^;]*)/gi;
  for (const m of ddl.matchAll(idxRe)) {
    const table = ensure(m[3].toLowerCase());
    const cols = m[4].replace(/\s+/g, " ").trim();
    const tail = m[5] ?? "";
    const where = /WHERE\s+(.+)$/i.exec(tail.trim())?.[1]?.replace(/\s+/g, " ").trim();
    table.indexes.push({ name: m[2].toLowerCase(), unique: Boolean(m[1]), cols, where });
  }

  return tables;
}

function coverage(tables, column) {
  return [...tables.entries()].filter(([, t]) => t.columns.has(column)).map(([n]) => n).sort();
}

function render(tables) {
  const names = [...tables.keys()].sort();
  const lines = [];
  lines.push("# 索引 / 约束 / 审计列覆盖清单（组三 H1）");
  lines.push("");
  lines.push("> **本文件由脚本生成，请勿手改**：`node scripts/db-index-inventory.mjs`。");
  lines.push("> 事实源是 `db/schema.sql` + `db/migrations/*.sql` 的 DDL 文本，非人工估算；");
  lines.push("> CI 门禁 `node scripts/db-index-inventory.mjs --check` 会在漂移时失败。");
  lines.push("");
  lines.push(`- 表：${names.length}`);
  const idxTotal = names.reduce((n, t) => n + tables.get(t).indexes.length, 0);
  const conTotal = names.reduce((n, t) => n + tables.get(t).constraints.length, 0);
  lines.push(`- 显式索引（CREATE INDEX）：${idxTotal}`);
  lines.push(`- 显式约束（CONSTRAINT / CHECK / UNIQUE / PK / FK）：${conTotal}`);
  lines.push("");
  lines.push("## 1. 列覆盖总览");
  lines.push("");
  lines.push("| 关注点 | 列 | 覆盖表数 |");
  lines.push("|---|---|---|");
  lines.push(`| 审计列 | \`updated_at\` | ${coverage(tables, "updated_at").length} |`);
  lines.push(`| 审计列 | \`created_at\` | ${coverage(tables, "created_at").length} |`);
  lines.push(`| 审计列 | \`created_by\` | ${coverage(tables, "created_by").length} |`);
  lines.push(`| 审计列 | \`updated_by\` | ${coverage(tables, "updated_by").length} |`);
  lines.push(`| 软删除 | \`deleted_at\` | ${coverage(tables, SOFT_DELETE_COLUMN).length} |`);
  lines.push(`| 乐观锁 | \`version\` | ${coverage(tables, LOCK_COLUMN).length} |`);
  lines.push("");
  lines.push("缺失清单（用于判断哪些表还需要补齐，不含纯日志/追加型表）：");
  lines.push("");
  for (const col of [...AUDIT_COLUMNS, SOFT_DELETE_COLUMN, LOCK_COLUMN]) {
    const have = new Set(coverage(tables, col));
    const missing = names.filter((n) => !have.has(n));
    lines.push(`- 缺 \`${col}\`（${missing.length}）：${missing.join(", ") || "无"}`);
  }
  lines.push("");
  lines.push("## 2. 全量索引清单");
  lines.push("");
  lines.push("| 表 | 索引 | 唯一 | 列 | 部分索引条件 |");
  lines.push("|---|---|---|---|---|");
  for (const name of names) {
    for (const idx of [...tables.get(name).indexes].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`| \`${name}\` | \`${idx.name}\` | ${idx.unique ? "是" : "否"} | \`${idx.cols}\` | ${idx.where ? `\`${idx.where}\`` : "-"} |`);
    }
  }
  lines.push("");
  lines.push("## 3. 每表约束");
  lines.push("");
  lines.push("| 表 | 约束 |");
  lines.push("|---|---|");
  for (const name of names) {
    const cons = tables.get(name).constraints;
    lines.push(`| \`${name}\` | ${cons.length ? cons.map((c) => `\`${c}\``).join("<br>") : "-"} |`);
  }
  lines.push("");
  return lines.join("\n");
}

const tables = parseDdl(readDdl());
const markdown = render(tables);

if (CHECK) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== markdown) {
    console.error("[db-index-inventory] 工件与 DDL 不一致，请运行 node scripts/db-index-inventory.mjs 重新生成");
    process.exitCode = 1;
  } else {
    console.log(`[db-index-inventory] 工件最新 ✔（表 ${tables.size}）`);
  }
} else {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, markdown, "utf8");
  console.log(`[db-index-inventory] 已生成 ${path.relative(ROOT, OUT)}（表 ${tables.size}）`);
}
