import { pgPool } from "./db";
import { logger } from "./logger";
import { pruneDiagnosticReports, summarizeDiagnosticReports } from "./diagnostics-store";

/** 崩溃率告警阈值：24h 内去重设备数 ≥ 10 台就 warn（单人刷上传不触发） */
export const DIAGNOSTIC_ALERT_DEVICES = 10;

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
  /** 清理掉的过期客户端诊断包文件数（v1.34.0：30 天保留策略） */
  diagnosticFiles: number;
}

export async function cleanupExpiredData(): Promise<CleanupResult> {
  const result: CleanupResult = { sessions: 0, authAttempts: 0, resetTokens: 0, syncChanges: 0, diagnosticFiles: 0 };
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
  /**
   * 客户端诊断包保留策略（v1.34.0，2026-10-07 评审）：
   * 诊断包只在"排障窗口"里有价值，超过 30 天即删 —— 既是磁盘/COS 成本，也是隐私负担。
   * 文件系统操作，与上面的 SQL 清理相互独立；失败只记日志。
   */
  try {
    const pruned = await pruneDiagnosticReports(30);
    result.diagnosticFiles = pruned.files;
    if (pruned.files > 0 || pruned.dirs > 0) {
      logger.info("[maintenance] diagnostics pruned:", pruned);
    }
  } catch (e) {
    logger.warn("[maintenance] diagnostics prune failed:", e);
  }
  /**
   * 崩溃率信号（v1.34.0）：最近 24h 诊断包按 App 版本聚合。
   * 连续多版"修闪退"却只能靠用户反馈的时代该结束了 —— 超过阈值直接 warn，便于外部采集告警。
   * v1.35.0（2026-10-07 二轮评审）：告警口径从**文件数**改为**按 installId 去重的设备数** ——
   * 文件数会被单人反复上传刷爆（限流允许 20 次/h），设备数才是"多点分布"的真实信号；
   * 文案注明 byVersion 只统计最新 50 份（量大时版本占比会低估）。
   */
  try {
    const summary = await summarizeDiagnosticReports();
    logger.info("[maintenance] diagnostics overview:", summary);
    if (summary.devices24h >= DIAGNOSTIC_ALERT_DEVICES) {
      logger.warn(
        "[maintenance] ⚠️ 24h 内诊断包 " + summary.last24h + " 个（去重后 " + summary.devices24h + " 台设备，" +
          "版本占比仅统计最新 " + summary.parsed + " 份）：" + JSON.stringify(summary.byVersion)
      );
    }
  } catch (e) {
    logger.warn("[maintenance] diagnostics overview failed:", e);
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
