import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { pgPool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession, sessionCookieName } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const COOKIE_SECURE = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  // 注册入口限流：防批量刷号/批量探测用户名（进程内，单实例有效）
  const throttle = await rateLimit(`register:${clientIp(req)}`, { limit: 5, windowMs: 3600_000 });
  if (!throttle.ok) {
    return NextResponse.json(
      { error: "注册过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, 64 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim().slice(0, 50) || null;

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "账号需为 3-32 位字母、数字、下划线、点或短横线" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: dup } = await client.query("SELECT 1 FROM accounts WHERE username = $1", [username]);
    if (dup.length > 0) {
      await client.query("ROLLBACK");
      // 模糊文案：不向请求方确认用户名是否存在（降低用户名枚举价值）
      return NextResponse.json({ error: "该账号不可用，请更换账号或直接登录" }, { status: 409 });
    }
    // 管理员授予：生产环境仅 ADMIN_USERNAME 指定的账号（防公网部署后被抢先注册者占据站长位，
    // 见 scripts/create-admin.mjs 兜底）；非生产保留「首个注册用户即管理员」便于本地开发。
    const adminUsername = process.env.ADMIN_USERNAME?.trim();
    const { rows: countRows } = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM users"
    );
    const isFirstUser = (countRows[0]?.n ?? 0) === 0;
    const grantAdmin = adminUsername
      ? username === adminUsername
      : process.env.NODE_ENV !== "production" && isFirstUser;

    const userId = randomUUID();
    await client.query(
      "INSERT INTO users (id, email, display_name, is_admin) VALUES ($1, $2, $3, $4)",
      [userId, username, displayName ?? username, grantAdmin]
    );
    await client.query(
      "INSERT INTO accounts (username, password_hash, user_id) VALUES ($1, $2, $3)",
      [username, await hashPassword(password), userId]
    );
    await client.query("COMMIT");

    const { token, expiresAt } = await createSession(userId);
    const res = NextResponse.json({
      ok: true,
      token,
      user: { id: userId, username, displayName },
    });
    res.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      secure: COOKIE_SECURE,
    });
    return res;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error("register failed:", e);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  } finally {
    client.release();
  }
}
