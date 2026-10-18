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

/**
 * 固定 dummy 哈希（S2-6）：账号不存在时也对同一密码跑一次同成本 scrypt，
 * 消除「账号存在 / 不存在」的响应耗时差（防用户名枚举）。
 * 成本参数与 lib/password.ts 的新格式一致（N=65536,r=8,p=1）；明文是随机占位串，
 * 不对应任何真实账号，校验必然失败。
 */
const DUMMY_HASH =
  "scrypt:65536:8:1:34299b56d751ed21f8423bb81cac656c:f125a859a0859937242164d7dded2facd8a3f3595935b2c83f4adc17adb45bcef45c7cdcfc092a39a51ab626253031a6750a21b860a27c5c8c865d8ffd9921ac";

export async function POST(req: Request) {
  // 第一道防线：按 IP 限流（进程内，单实例有效）
  const ip = clientIp(req);
  const throttle = await rateLimit(`login:${ip}`, { limit: 20, windowMs: 60_000 });
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

  // 第二道防线：按用户名限流（单账号爆破收紧；伪造 XFF 绕过 IP 限流时仍然生效）
  const userThrottle = await rateLimit(`login-user:${username}`, { limit: 10, windowMs: 60_000 });
  if (!userThrottle.ok) {
    return NextResponse.json(
      { error: "尝试过于频繁，请稍后再试", retryAfter: userThrottle.retryAfterSeconds },
      { status: 429 }
    );
  }

  const { rows } = await pgPool.query(
    `SELECT a.password_hash, u.id AS user_id, u.display_name AS "displayName"
     FROM accounts a JOIN users u ON u.id = a.user_id WHERE a.username = $1`,
    [username]
  );
  const account = rows[0];
  // 账号不存在时走 DUMMY_HASH：两条路径都执行一次相同成本的 scrypt，耗时不可区分
  const ok = await verifyPassword(password, account?.password_hash ?? DUMMY_HASH);
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
  // 匿名数据认领：仅认领当前设备（anon_id）产生的匿名行（S1-7 已移除 claimLegacy 后门）
  await claimAnonData(uid, { anonId: await getAnonId() });

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