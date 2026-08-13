// drivers.mjs — 数据库驱动加载（pg / mysql2），带本地 fallback
// pg 依赖位于 apps/web/node_modules；mysql2 可位于迁移目录或 Travel-Notes 项目。
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);

export function loadPg() {
  try {
    return require("pg");
  } catch {}
  const candidates = [
    path.join(process.cwd(), "apps/web/node_modules/pg"),
    path.join(process.cwd(), "node_modules/pg"),
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {}
  }
  throw new Error("找不到 pg 模块，请先执行 pnpm install（apps/web 依赖）");
}

export function loadMysql() {
  try {
    return require("mysql2/promise");
  } catch {}
  const candidates = [
    path.join(process.cwd(), "node_modules/mysql2/promise"),
    path.join("F:/CodeFiles/Travel-Notes/node_modules/mysql2/promise"),
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {}
  }
  return null; // MySQL 不可用时不阻塞（学习内容主要在 Markdown）
}

export function pgPool() {
  const pg = loadPg();
  return new pg.Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "Learn-Workbench",
    user: process.env.PGUSER || "postgres",
    connectionTimeoutMillis: 5000,
  });
}
