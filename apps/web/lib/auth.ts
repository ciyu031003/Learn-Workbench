import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { ANON_CLAIM_TABLES } from "@/lib/anon-tables";

/* ============================================================================
 * P0 安全加固：管理员鉴权 + 登录防爆破 + 匿名数据设备化认领
 * ==========================================================================*/

/**
 * 从代理头解析客户端 IP（nginx 反代场景）。
 *
 * deploy/nginx/learn-workbench.conf 里显式设置：
 *   proxy_set_header X-Real-IP $remote_addr;              （单值，nginx 会覆盖客户端自报值）
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  （追加式）
 * XFF 前面的段都是客户端可伪造的自报值，只有最后一段才是代理追加的可信地址 ——
 * 取第一段会让按 IP 的限流/审计被伪造头绕过。
 *
 * S2-7：生产环境只信任「带 nginx 可信头」的请求。
 * nginx 一定会设置 X-Real-IP；若生产请求里没有它，说明请求可能是绕过反代直连应用端口的，
 * 此时客户端自报的 X-Forwarded-For 一律不采信，统一归到 "unknown"。
 * 代价：这些请求共用一个限流桶（宁可误伤也不让伪造头绕过限流）；直连入口已在
 * docker-compose 中收敛到 127.0.0.1，正常公网流量都会带 X-Real-IP。
 * 非生产环境保留 XFF 解析，方便本地与测试。
 */
export function clientIp(req: Request): string {
  // 1) nginx 设置的单值头（客户端自报会被 proxy_set_header 覆盖）——最可信
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // 2) 生产环境没有 nginx 可信头时，不信任客户端自报的 XFF
  if (process.env.NODE_ENV === "production") return "unknown";

  // 3) 非生产：XFF 末段（本地/测试无 nginx，保留原有解析行为）
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
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

/* ---------------- 匿名数据设备化认领（H5 / S1-7） ---------------- */

/**
 * 认领匿名数据：只认领**当前设备**（anon_id 匹配）产生的匿名行。
 *
 * 2026-10-18 S1-7：**移除 claimLegacy**。旧实现允许客户端传 claimLegacy:true，
 * 把全站所有遗留匿名行（anon_id IS NULL）一次性并入任意账号 —— 越权获取 + 原设备数据消失。
 * 遗留 NULL 池已由迁移 078 孤儿化（分配随机 anon_id），不再存在"无人认领的共享池"。
 */
export async function claimAnonData(
  userId: string,
  opts: { anonId?: string | null } = {}
): Promise<number> {
  const { anonId } = opts;
  if (!anonId) return 0;
  const client = await pgPool.connect();
  let claimed = 0;
  try {
    await client.query("BEGIN");
    for (const table of ANON_CLAIM_TABLES) {
      const r = await client.query(
        `UPDATE ${table} SET user_id = $1, anon_id = NULL WHERE user_id IS NULL AND anon_id = $2`,
        [userId, anonId]
      );
      claimed += r.rowCount ?? 0;
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