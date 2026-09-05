import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { createSession, currentUser, sessionCookieName } from "@/lib/session";
import { verifyState, exchangeCode, isWechatEnabled } from "@/lib/wechat";
import { findUserIdByWechat, createWechatUser, bindWechatIdentity } from "@/lib/identities";
import { claimAnonData } from "@/lib/auth";
import { getAnonId } from "@/lib/anon";

const COOKIE_SECURE = process.env.NODE_ENV === "production";

/**
 * 微信扫码回调兑换：
 * - 未登录：openid 已绑定 → 直接登录；未绑定 → 创建新用户并绑定（返回 created:true）
 * - 已登录（携带会话）：将微信身份绑定到当前账号
 */
export async function POST(req: Request) {
  if (!isWechatEnabled()) return NextResponse.json({ error: "微信登录未配置" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const code = String(body.code ?? "").trim();
  const state = String(body.state ?? "").trim();
  if (!code || !verifyState(state)) {
    return NextResponse.json({ error: "授权状态无效或已过期，请重新扫码" }, { status: 400 });
  }

  const profile = await exchangeCode(code);
  if (!profile) return NextResponse.json({ error: "微信授权失败，请重试" }, { status: 401 });

  const user = await currentUser();
  if (user) {
    const result = await bindWechatIdentity(user.id, profile);
    if (result === "conflict") {
      return NextResponse.json({ error: "该微信已绑定其他账号" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, bound: true });
  }

  const existingUserId = await findUserIdByWechat(profile.openid, profile.unionid);
  let userId = existingUserId;
  let created = false;
  let username: string | null = null;

  if (!userId) {
    const createdUser = await createWechatUser(profile);
    userId = createdUser.userId;
    username = createdUser.username;
    created = true;
  } else {
    const { rows } = await pgUsername(userId);
    username = rows[0]?.username ?? null;
  }

  if (!userId) return NextResponse.json({ error: "登录失败，请重试" }, { status: 500 });

  // 匿名数据认领：新用户/换设备登录时认领本机匿名数据（与密码登录一致）
  try {
    await claimAnonData(userId, { anonId: await getAnonId(), claimLegacy: false });
  } catch {
    // 认领失败不阻塞登录
  }

  const { token, expiresAt } = await createSession(userId);
  const res = NextResponse.json({ ok: true, token, created, user: { id: userId, username } });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: COOKIE_SECURE,
  });
  return res;
}

function pgUsername(userId: string) {
  return pgPool.query<{ username: string }>(
    "SELECT a.username FROM accounts a WHERE a.user_id = $1 LIMIT 1",
    [userId]
  );
}
