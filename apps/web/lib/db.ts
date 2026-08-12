import { Pool, types } from "pg";

// date 类型直接返回 YYYY-MM-DD 字符串，避免时区偏移
types.setTypeParser(1082, (v: string) => v);

// 本地 PostgreSQL（Learn-Workbench 数据库，仅 localhost，trust 认证）
const globalForPg = globalThis as unknown as { lwbPgPool?: Pool };

export const pgPool: Pool =
  globalForPg.lwbPgPool ??
  new Pool({
    host: "127.0.0.1",
    port: 5432,
    database: "Learn-Workbench",
    user: "postgres",
    max: 10,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.lwbPgPool = pgPool;
