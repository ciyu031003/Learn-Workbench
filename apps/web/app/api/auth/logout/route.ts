import { NextResponse } from "next/server";
import { currentSessionToken, destroySession, sessionCookieName } from "@/lib/session";

/**
 * POST /api/auth/logout —— 退出并**吊销**服务端会话（S2-4）。
 *
 * 从 cookie **或 Authorization: Bearer** 取令牌（currentSessionToken），按 token_hash
 * 删除会话行：移动端退出时也要真的把会话吊销掉，不能只清本地凭证。最后清 cookie。
 */
export async function POST() {
  const token = await currentSessionToken();
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
