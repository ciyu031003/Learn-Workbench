import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

const COOKIE_NAME = "lwb_session";
const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
}

/** 从 cookie 或 Authorization: Bearer 中解析当前登录用户 id */
export async function currentUserId(): Promise<string | null> {
  const token = await resolveToken();
  if (!token) return null;
  const { rows } = await pgPool.query<{ user_id: string }>(
    `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()`,
    [token]
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
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] ?? null;
}

async function resolveToken(): Promise<string | null> {
  const store = await cookies();
  const cookieToken = store.get(COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;
  // 移动端 / API：Authorization: Bearer <token>
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await pgPool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await pgPool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

export const sessionCookieName = COOKIE_NAME;

