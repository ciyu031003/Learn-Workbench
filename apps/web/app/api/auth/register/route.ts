import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { pgPool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession, sessionCookieName } from "@/lib/session";
import { parseBody } from "@/lib/http";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const COOKIE_SECURE = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
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
      return NextResponse.json({ error: "该账号已被注册，请直接登录" }, { status: 409 });
    }
    // 首个注册用户自动成为管理员（个人自托管部署：首位注册者即站长）
    const { rows: countRows } = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM users"
    );
    const isFirstUser = (countRows[0]?.n ?? 0) === 0;

    const userId = randomUUID();
    await client.query(
      "INSERT INTO users (id, email, display_name, is_admin) VALUES ($1, $2, $3, $4)",
      [userId, username, displayName ?? username, isFirstUser]
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
    console.error("register failed:", e);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  } finally {
    client.release();
  }
}