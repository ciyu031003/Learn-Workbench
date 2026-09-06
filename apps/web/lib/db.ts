import { Pool, types, type PoolConfig } from "pg";

// date 类型直接返回 YYYY-MM-DD 字符串，避免时区偏移
types.setTypeParser(1082, (v: string) => v);

// PostgreSQL 连接（默认本地开发配置；服务器部署可通过环境变量覆盖）
//   PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD
//   PGPOOL_MAX（默认 20）/ PG_STATEMENT_TIMEOUT_MS（默认 15000）
// statement_timeout：慢查询超时即中断，防止单条烂查询长期占用连接池；
// 调大前先确认 PostgreSQL max_connections（默认 100）。
const pgConfig: PoolConfig = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "Learn-Workbench",
  user: process.env.PGUSER || "postgres",
  max: Number(process.env.PGPOOL_MAX || 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5000,
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15_000),
};
if (process.env.PGPASSWORD) pgConfig.password = process.env.PGPASSWORD;

const globalForPg = globalThis as unknown as { lwbPgPool?: Pool };

export const pgPool: Pool =
  globalForPg.lwbPgPool ??
  new Pool(pgConfig);

if (process.env.NODE_ENV !== "production") globalForPg.lwbPgPool = pgPool;
