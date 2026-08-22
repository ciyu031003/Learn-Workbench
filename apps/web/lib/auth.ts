import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";

/* ============================================================================
 * P0 安全加固：管理员鉴权 + 登录防爆破 + 匿名数据设备化认领
 * ==========================================================================*/

/** 从代理头解析客户端 IP（nginx 反代场景） */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "";
  return req.headers.get("x-real-ip") || "unknown";
}

/** 管理员鉴权（users.is_admin，由 create-admin.mjs / 首个注册用户设置） */
export async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await pgPool.query<{ is_admin: boolean }>(
    `SELECT is_admin FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.is_admin === true;
}

/* ---------------- 登录防爆破（auth_attempts） ---------------- */

export async function recordLoginFailure(username: string, ip: string): Promise<void> {
  await pgPool.query(
    `INSERT INTO auth_attempts (username, ip, success) VALUES ($1, $2, false)`,
    [username, ip]
  );
}

export async function recordLoginSuccess(username: string, ip: string): Promise<void> {
  await pgPool.query(
    `INSERT INTO auth_attempts (username, ip, success) VALUES ($1, $2, true)`,
    [username, ip]
  );
  await pgPool.query(
    `DELETE FROM auth_attempts WHERE username = $1 AND success = false`,
    [username]
  );
}

export interface LoginLock {
  locked: boolean;
  retryAfterSeconds: number;
}

/** 登录锁定检查：窗口内失败次数达到上限则锁定 */
export async function loginLocked(
  username: string,
  opts: { maxFailures?: number; windowMs?: number } = {}
): Promise<LoginLock> {
  const { maxFailures = 5, windowMs = 15 * 60_000 } = opts;
  const { rows } = await pgPool.query<{ n: number; last: Date | null }>(
    `SELECT count(*)::int AS n, max(created_at) AS last
       FROM auth_attempts
      WHERE username = $1 AND success = false
        AND created_at > now() - make_interval(secs => $2)`,
    [username, Math.floor(windowMs / 1000)]
  );
  const n = rows[0]?.n ?? 0;
  if (n >= maxFailures) {
    const last = rows[0]?.last ? new Date(rows[0].last).getTime() : Date.now();
    const retryAfterSeconds = Math.max(1, Math.ceil((last + windowMs - Date.now()) / 1000));
    return { locked: true, retryAfterSeconds };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

/* ---------------- 匿名数据设备化认领（H5） ---------------- */

/** 匿名数据表清单（与 login 原 claimAnonData 一致） */
const ANON_TABLES = [
  "topic_progress",
  "daily_tasks",
  "focus_sessions",
  "checkins",
  "log_entries",
  "certificates",
  "xp_events",
  "resume_assets",
];

/**
 * 认领匿名数据：
 * - 默认只认领当前设备（anon_id 匹配）产生的匿名行，避免「先注册者继承所有匿名数据」；
 * - 迁移前的遗留匿名行（anon_id IS NULL）仅在调用方显式声明 claimLegacy 时认领。
 */
export async function claimAnonData(
  userId: string,
  opts: { anonId?: string | null; claimLegacy?: boolean } = {}
): Promise<number> {
  const { anonId, claimLegacy } = opts;
  const client = await pgPool.connect();
  let claimed = 0;
  try {
    await client.query("BEGIN");
    if (anonId) {
      for (const table of ANON_TABLES) {
        const r = await client.query(
          `UPDATE ${table} SET user_id = $1, anon_id = NULL WHERE user_id IS NULL AND anon_id = $2`,
          [userId, anonId]
        );
        claimed += r.rowCount ?? 0;
      }
    }
    if (claimLegacy) {
      for (const table of ANON_TABLES) {
        const r = await client.query(
          `UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL AND anon_id IS NULL`,
          [userId]
        );
        claimed += r.rowCount ?? 0;
      }
    }
    await client.query("COMMIT");
    return claimed;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** 当前匿名作用域值：已登录返回 null（不追加 anon 过滤）；未登录返回设备标识 */
export async function anonScopeValue(): Promise<string | null> {
  const uid = await currentUserId();
  if (uid) return null;
  return getAnonId();
}