import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { verifyPassword, hashPassword, needsRehash } from "@/lib/password";
import { createSession, sessionCookieName } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import {
  claimAnonData,
  clientIp,
  loginLocked,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth";
import { getAnonId } from "@/lib/anon";

const COOKIE_SECURE = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  // 第一道防线：按 IP 限流（进程内，单实例有效）
  const ip = clientIp(req);
  const throttle = rateLimit(`login:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!throttle.ok) {
    return NextResponse.json(
      { error: "尝试过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, 64 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "请输入账号和密码" }, { status: 400 });
  }

  const { rows } = await pgPool.query(
    `SELECT a.password_hash, u.id AS user_id, u.display_name AS "displayName"
     FROM accounts a JOIN users u ON u.id = a.user_id WHERE a.username = $1`,
    [username]
  );
  const account = rows[0];
  const ok = await verifyPassword(password, account?.password_hash ?? "");
  if (!account || !ok) {
    await recordLoginFailure(username, ip);
    const lock = await loginLocked(username);
    if (lock.locked) {
      return NextResponse.json(
        { error: `登录失败次数过多，请 ${Math.ceil(lock.retryAfterSeconds / 60)} 分钟后再试`, retryAfter: lock.retryAfterSeconds },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }
  await recordLoginSuccess(username, ip);

  const uid = account.user_id as string;
  // 匿名数据认领：仅认领当前设备（anon_id）产生的匿名行；历史遗留行需显式 claimLegacy
  await claimAnonData(uid, {
    anonId: await getAnonId(),
    claimLegacy: body.claimLegacy === true,
  });

  // 旧格式密码哈希登录成功后自动升级（scrypt 成本参数）
  if (needsRehash(account.password_hash)) {
    const upgraded = await hashPassword(password);
    await pgPool
      .query(`UPDATE accounts SET password_hash = $1 WHERE user_id = $2`, [upgraded, uid])
      .catch(() => {});
  }

  const { token, expiresAt } = await createSession(uid);
  const res = NextResponse.json({
    ok: true,
    token,
    user: { id: uid, username, displayName: account.displayName },
  });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: COOKIE_SECURE,
  });
  return res;
}