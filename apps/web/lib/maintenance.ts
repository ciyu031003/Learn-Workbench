import { pgPool } from "./db";
import { logger } from "./logger";

/**
 * 过期/审计数据定期清理（由 /api/internal/cron 每日触发）：
 * - sessions：过期 7 天后的会话行（防止表无限膨胀；活跃会话不受影响）
 * - auth_attempts：30 天前的登录尝试审计
 * - password_reset_tokens：已过期或已使用（一次性令牌用后即可删）
 * - sync_changes：90 天前的同步审计（按服务器写入时间 synced_at 计）
 * 单项失败只记日志不影响其余项；全部幂等，可安全重复执行。
 */
export interface CleanupResult {
  sessions: number;
  authAttempts: number;
  resetTokens: number;
  syncChanges: number;
}

export async function cleanupExpiredData(): Promise<CleanupResult> {
  const result: CleanupResult = { sessions: 0, authAttempts: 0, resetTokens: 0, syncChanges: 0 };
  const tasks: [keyof CleanupResult, string][] = [
    ["sessions", `DELETE FROM sessions WHERE expires_at < now() - interval '7 days'`],
    ["authAttempts", `DELETE FROM auth_attempts WHERE created_at < now() - interval '30 days'`],
    [
      "resetTokens",
      `DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day' OR used_at IS NOT NULL`,
    ],
    ["syncChanges", `DELETE FROM sync_changes WHERE synced_at < now() - interval '90 days'
       OR (synced_at IS NULL AND created_at < now() - interval '180 days')`],
  ];
  for (const [key, sql] of tasks) {
    try {
      const r = await pgPool.query(sql);
      result[key] = r.rowCount ?? 0;
    } catch (e) {
      logger.warn("[maintenance] cleanup failed:", key, e);
    }
  }
  return result;
}

/**
 * 登录异常量监控（每日 maintenance job 附带执行）：
 * 扫描最近 24 小时 auth_attempts，失败总量或单账号失败量超阈值时 logger.warn 告警
 * （配合 docker logs / PM2 日志采集触发外部通知）。只读，不产生副作用。
 */
export interface SecurityAlertResult {
  failed24h: number;
  distinctUsernames: number;
  topUsername: string | null;
  topUsernameCount: number;
  alerted: boolean;
}

export async function securityAlerts(
  opts: { maxFailures24h?: number; maxPerUsername24h?: number } = {}
): Promise<SecurityAlertResult> {
  const { maxFailures24h = 200, maxPerUsername24h = 30 } = opts;
  const snapshot: SecurityAlertResult = {
    failed24h: 0,
    distinctUsernames: 0,
    topUsername: null,
    topUsernameCount: 0,
    alerted: false,
  };
  try {
    const { rows } = await pgPool.query<{ n: number; users: number }>(
      `SELECT count(*)::int AS n, count(DISTINCT username)::int AS users
       FROM auth_attempts WHERE success = false AND created_at > now() - interval '24 hours'`
    );
    snapshot.failed24h = rows[0]?.n ?? 0;
    snapshot.distinctUsernames = rows[0]?.users ?? 0;
    const { rows: top } = await pgPool.query<{ username: string; n: number }>(
      `SELECT username, count(*)::int AS n
       FROM auth_attempts WHERE success = false AND created_at > now() - interval '24 hours'
       GROUP BY username ORDER BY n DESC LIMIT 1`
    );
    if (top[0]) {
      snapshot.topUsername = top[0].username;
      snapshot.topUsernameCount = top[0].n;
    }
    if (snapshot.failed24h >= maxFailures24h || snapshot.topUsernameCount >= maxPerUsername24h) {
      snapshot.alerted = true;
      logger.warn(
        `[security] 异常登录失败量（24h 失败 ${snapshot.failed24h} 次 / 涉及 ${snapshot.distinctUsernames} 个账号；` +
          `最多 ${snapshot.topUsername} × ${snapshot.topUsernameCount}）——疑似爆破或撞库，请检查来源 IP`
      );
    }
  } catch (e) {
    logger.warn("[maintenance] security scan failed:", e);
  }
  return snapshot;
}
