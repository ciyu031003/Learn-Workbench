import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { parseBody } from "@/lib/http";
import { currentUserId, destroySession } from "@/lib/session";
import { sessionCookieName } from "@/lib/session";
import { verifyPassword } from "@/lib/password";

const COOKIE_SECURE = process.env.NODE_ENV === "production";

/**
 * 注销账号（合规必需）：删除 users 行，业务数据经 ON DELETE CASCADE 一并清除。
 * 设有密码登录的账号需验证当前密码，防误删/盗号注销。
 */
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const parsed = await parseBody(req, 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const password = String((parsed.data as Record<string, unknown> | null)?.password ?? "");

  const { rows } = await pgPool.query<{ password_hash: string }>(
    "SELECT password_hash FROM accounts WHERE user_id = $1 AND password_hash <> 'wx:no-password' LIMIT 1",
    [userId]
  );
  if (rows[0]) {
    const ok = password && (await verifyPassword(password, rows[0].password_hash));
    if (!ok) return NextResponse.json({ error: "请输入当前密码以确认注销" }, { status: 403 });
  }

  await pgPool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  await pgPool.query("DELETE FROM users WHERE id = $1", [userId]);

  const res = NextResponse.json({ ok: true, deleted: true });
  res.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: COOKIE_SECURE });
  return res;
}
