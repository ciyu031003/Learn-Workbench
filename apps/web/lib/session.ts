import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { pgPool } from "./db";

const COOKIE_NAME = "lwb_session";
const SESSION_TTL_DAYS = 30;

/** last_used_at 刷新节流窗口（SQL 字面量；不拼任何外部输入） */
const TOUCH_WINDOW_SQL = "interval '60 seconds'";

/** user_agent 落库上限（浏览器 UA 一般 <300，防超长头写爆行） */
const USER_AGENT_MAX_LEN = 512;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
}

/**
 * 会话令牌只存哈希（sha256）：数据库/备份泄露时无法用 token_hash 反推原始令牌。
 * 令牌本身是 32 字节 CSPRNG（熵足够），哈希不降低安全性。
 *
 * S2-3b（迁移 079）起：INSERT **只写 token_hash**，明文 token 列收敛为可空、保留列
 * 只用于旧镜像回滚兼容（DELETE COLUMN 留到 S4 二次发布）。destroySession 也只按
 * token_hash 删。
 *
 * 导出给设备管理路由（/api/auth/sessions）复用：只比对哈希，绝不接触明文。
 *
 * ⚠️ 防御式：`createHash().update(null)` 会抛 `ERR_INVALID_ARG_TYPE` 并变成 500
 * （2026-09-15 匿名请求 500 的根因）。这里把空值归一化成空串 —— 空串哈希查不到任何会话，
 * 语义上等价于「未登录」，且绝不抛错。调用方仍应先用 `if (!token) return null` 短路。
 */
export function sessionTokenHash(token: string | null | undefined): string {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

/** 从 cookie 或 Authorization: Bearer 中解析当前登录用户 id */
export async function currentUserId(): Promise<string | null> {
  const token = await resolveToken();
  if (!token) return null;
  // 命中会话后在同一条 SQL 里按需刷新 last_used_at（60 秒节流），不增加往返次数
  return touchSession(sessionTokenHash(token));
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = await resolveToken();
  if (!token) return null;
  const { rows } = await pgPool.query<SessionUser>(
    `WITH cur AS (
       SELECT user_id, last_used_at FROM sessions WHERE token_hash = $1 AND expires_at > now()
     ), touched AS (
       UPDATE sessions SET last_used_at = now()
       FROM cur
       WHERE sessions.token_hash = $1
         AND (cur.last_used_at IS NULL OR cur.last_used_at < now() - ${TOUCH_WINDOW_SQL})
     )
     SELECT u.id, a.username, u.display_name AS "displayName"
     FROM cur
     JOIN users u ON u.id = cur.user_id
     JOIN accounts a ON a.user_id = u.id`,
    [sessionTokenHash(token)]
  );
  return rows[0] ?? null;
}

/**
 * 校验会话并按需刷新 last_used_at（S2-3b）。
 *
 * 性能：lookup + touch **一条语句**完成，且 `last_used_at` 距上次写入不足 60 秒时
 * 跳过 UPDATE（避免每个请求都产生一次行写 + WAL）。空 token_hash 直接返回 null，
 * 绝不把空值送进 SQL。
 *
 * @returns 命中的 user_id；无会话/已过期返回 null
 */
export async function touchSession(tokenHash: string | null | undefined): Promise<string | null> {
  if (!tokenHash) return null;
  const { rows } = await pgPool.query<{ user_id: string }>(
    `WITH cur AS (
       SELECT token_hash, user_id, last_used_at FROM sessions WHERE token_hash = $1 AND expires_at > now()
     ), touched AS (
       UPDATE sessions SET last_used_at = now()
       FROM cur
       WHERE sessions.token_hash = cur.token_hash
         AND (cur.last_used_at IS NULL OR cur.last_used_at < now() - ${TOUCH_WINDOW_SQL})
     )
     SELECT user_id FROM cur`,
    [tokenHash]
  );
  return rows[0]?.user_id ?? null;
}

export async function currentSessionToken(): Promise<string | null> {
  const store = await cookies();
  const cookieToken = store.get(COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;
  // 移动端 / API：Authorization: Bearer <token>
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

async function resolveToken(): Promise<string | null> {
  return currentSessionToken();
}

/**
 * 从 UA 归一出一句可读设备标签（设备管理列表用）。
 * 纯展示字段：解析失败返回 null，绝不影响登录。
 */
export function deviceLabelFromUserAgent(ua: string | null | undefined): string | null {
  const raw = String(ua ?? "").trim();
  if (!raw) return null;
  const s = raw.slice(0, USER_AGENT_MAX_LEN);

  // 移动端 App（RN fetch / 原生 WebView）：Android 多为 okhttp，iOS 多为 CFNetwork
  if (/okhttp|cfnetwork|expo|reactnative|react-native|dalvik/i.test(s)) return "移动端 App";

  let os = "";
  if (/iphone/i.test(s)) os = "iPhone";
  else if (/ipad/i.test(s)) os = "iPad";
  else if (/android/i.test(s)) os = "Android";
  else if (/windows nt/i.test(s)) os = "Windows";
  else if (/macintosh|mac os x/i.test(s)) os = "macOS";
  else if (/linux/i.test(s)) os = "Linux";

  // 注意顺序：Edge/Chrome 的 UA 里都带 "Safari"；Chrome 带 "Safari" 但不带 "Version/"
  let browser = "";
  if (/edg\//i.test(s)) browser = "Edge";
  else if (/chrome|crios/i.test(s)) browser = "Chrome";
  else if (/firefox|fxios/i.test(s)) browser = "Firefox";
  else if (/safari/i.test(s)) browser = "Safari";

  if (browser && os) return browser + " · " + os;
  if (browser) return browser;
  if (os) return os;
  return s.slice(0, 64);
}

/** 读取当前请求的 UA（非请求上下文返回 null，绝不抛错） */
async function sessionRequestMeta(): Promise<{ userAgent: string | null; deviceLabel: string | null }> {
  try {
    const h = await headers();
    const raw = typeof h?.get === "function" ? h.get("user-agent") : null;
    const userAgent = raw ? String(raw).slice(0, USER_AGENT_MAX_LEN) : null;
    return { userAgent, deviceLabel: deviceLabelFromUserAgent(userAgent) };
  } catch {
    return { userAgent: null, deviceLabel: null };
  }
}

/**
 * 新建会话：**只写 token_hash**（不再双写明文 token），同时记录设备信息。
 * 有效期 30 天；返回原始 token 交给调用方写 cookie / 下发移动端。
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  const meta = await sessionRequestMeta();
  await pgPool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, last_used_at, user_agent, device_label)
     VALUES ($1, $2, $3, now(), $4, $5)`,
    [sessionTokenHash(token), userId, expiresAt, meta.userAgent, meta.deviceLabel]
  );
  return { token, expiresAt };
}

export async function destroySession(token: string | null | undefined): Promise<void> {
  // 防御式：空 token 直接返回（避免 hash 空值，也避免误删）
  if (!token) return;
  // 只按 token_hash 删（S2-3b：新行不再存明文 token；033 已回填全部存量行的 token_hash）
  await pgPool.query(`DELETE FROM sessions WHERE token_hash = $1`, [sessionTokenHash(token)]);
}

export const sessionCookieName = COOKIE_NAME;
