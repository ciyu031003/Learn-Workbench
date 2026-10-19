import pkg from "../package.json";
import { pgPool } from "./db";

/**
 * 健康检查（S4-2）：容器/进程探活用的最小事实集。
 *
 * 设计约束：
 *  - **不暴露内部细节**：只返回 ok/degraded、db up/down、版本、迁移文件名、uptime、时间戳；
 *    不返回错误消息 / 连接串 / SQL。
 *  - **探活不能比探活超时更慢**：DB 用 800ms 独立超时（compose healthcheck timeout 3s），
 *    超时即判 down，并吞掉「超时后才失败」的 rejection（避免 unhandledRejection 打崩进程）。
 *  - **迁移记录读不到不算故障**：schema_migrations 只由 docker-init-db.sh 创建（PM2 路径可能没有），
 *    失败/超时记 null，HTTP 仍是 200。
 */

/** DB 探活超时（ms）：比 healthcheck timeout(3s) 短，避免探活自身被 DB 拖住 */
export const HEALTH_DB_TIMEOUT_MS = 800;

export interface HealthReport {
  status: "ok" | "degraded";
  db: "up" | "down";
  version: string;
  migrations: string | null;
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * 应用版本，优先级：
 *  1) NEXT_PUBLIC_APP_VERSION（构建期注入、可暴露给客户端）
 *  2) APP_VERSION（S4-4 镜像 CI 注入：Dockerfile `ARG APP_VERSION` → `ENV APP_VERSION`）
 *  3) apps/web/package.json 的 version（本地 / 未注入时的兜底）
 */
export function appVersion(): string {
  for (const raw of [process.env.NEXT_PUBLIC_APP_VERSION, process.env.APP_VERSION]) {
    const v = String(raw ?? "").trim();
    if (v) return v;
  }
  const v = (pkg as { version?: unknown }).version;
  return typeof v === "string" && v.trim() ? v.trim() : "unknown";
}

/**
 * 限时等待：超时返回 null（不抛错）。
 * 额外挂一个 catch：Promise.race 输掉的 promise 若在之后 reject，不处理会冒成
 * unhandledRejection（Node 默认可能终止进程），这里显式吞掉。
 */
async function settleWithin<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  p.catch(() => undefined);
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 轻量探活：SELECT 1，true=up；超时/连接失败/查询失败一律 false（绝不抛错） */
export async function pingDb(timeoutMs: number = HEALTH_DB_TIMEOUT_MS): Promise<boolean> {
  try {
    const res = await settleWithin(pgPool.query("SELECT 1"), timeoutMs);
    return res !== null;
  } catch {
    return false;
  }
}

/**
 * 已应用的最大迁移（schema_migrations 最新 filename）。
 * 表不存在 / 查询失败 / 超时 → null（不影响探活结论）。
 */
export async function latestMigration(timeoutMs: number = HEALTH_DB_TIMEOUT_MS): Promise<string | null> {
  try {
    const res = await settleWithin(
      pgPool.query<{ filename: string }>(
        "SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 1"
      ),
      timeoutMs
    );
    const name = res?.rows?.[0]?.filename;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

/** 汇总健康报告（DB down 时不做迁移查询，直接 null） */
export async function getHealth(): Promise<HealthReport> {
  const dbUp = await pingDb();
  return {
    status: dbUp ? "ok" : "degraded",
    db: dbUp ? "up" : "down",
    version: appVersion(),
    migrations: dbUp ? await latestMigration() : null,
    uptimeSeconds: Math.max(0, Math.round(process.uptime())),
    timestamp: new Date().toISOString(),
  };
}
