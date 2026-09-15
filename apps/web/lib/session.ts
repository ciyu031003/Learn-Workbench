import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { pgPool } from "./db";

const COOKIE_NAME = "lwb_session";
const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
}

/**
 * 会话令牌只存哈希（sha256）：数据库/备份泄露时无法用 token_hash 反推原始令牌。
 * 令牌本身是 32 字节 CSPRNG（熵足够），哈希不降低安全性。token 列为过渡期双写保留
 * （迁移 033，回滚兼容），收敛 DDL 执行后可移除。
 *
 * ⚠️ 防御式：`createHash().update(null)` 会抛 `ERR_INVALID_ARG_TYPE` 并变成 500
 * （2026-09-15 匿名请求 500 的根因）。这里把空值归一化成空串 —— 空串哈希查不到任何会话，
 * 语义上等价于「未登录」，且绝不抛错。调用方仍应先用 `if (!token) return null` 短路。
 */
function hashToken(token: string | null | undefined): string {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

/** 从 cookie 或 Authorization: Bearer 中解析当前登录用户 id */
export async function currentUserId(): Promise<string | null> {
  const token = await resolveToken();
  if (!token) return null;
  const { rows } = await pgPool.query<{ user_id: string }>(
    `SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0]?.user_id ?? null;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = await resolveToken();
  if (!token) return null;
  const { rows } = await pgPool.query<SessionUser>(
    `SELECT u.id, a.username, u.display_name AS "displayName"
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN accounts a ON a.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0] ?? null;
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

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await pgPool.query(
    `INSERT INTO sessions (token, token_hash, user_id, expires_at) VALUES ($1, $2, $3, $4)`,
    [token, hashToken(token), userId, expiresAt]
  );
  return { token, expiresAt };
}

export async function destroySession(token: string | null | undefined): Promise<void> {
  // 防御式：空 token 直接返回（避免 hash 空值，也避免误删）
  if (!token) return;
  // 同时覆盖哈希行（新代码写入）与明文行（过渡期前的存量/回滚写入）
  await pgPool.query(`DELETE FROM sessions WHERE token_hash = $1 OR token = $2`, [
    hashToken(token),
    token,
  ]);
}

export const sessionCookieName = COOKIE_NAME;
