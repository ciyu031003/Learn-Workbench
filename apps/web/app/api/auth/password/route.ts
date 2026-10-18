import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentSessionToken, currentUserId, sessionTokenHash } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseBody } from "@/lib/http";
import { validatePassword } from "@learn-workbench/shared";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const parsed = await parseBody(req, 64 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");
  if (!current) return NextResponse.json({ error: "请输入当前密码" }, { status: 400 });
  // S2-6：统一密码策略（8-128 位 + 弱口令黑名单）
  const nextError = validatePassword(next);
  if (nextError) return NextResponse.json({ error: nextError }, { status: 400 });

  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "未登录" }, { status: 401 });

  // S2-2：按用户限流（防已登录会话被用来暴力校验当前密码 / 批量改密）
  const throttle = await rateLimit(`auth:password:${uid}`, { limit: 5, windowMs: 60_000 });
  if (!throttle.ok) {
    return NextResponse.json(
      { error: "操作过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds },
      { status: 429 }
    );
  }

  const { rows } = await pgPool.query<{ password_hash: string }>(
    `SELECT password_hash FROM accounts WHERE user_id = $1`,
    [uid]
  );
  const account = rows[0];
  if (!account || !(await verifyPassword(current, account.password_hash))) {
    return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
  }

  const hash = await hashPassword(next);
  const token = await currentSessionToken();
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE accounts SET password_hash = $1 WHERE user_id = $2`, [hash, uid]);
    // 修改密码后使其他会话失效，保留当前登录。
    // S2-3b（迁移 079）起新会话的明文 token 列为 NULL，必须按 token_hash 比对，
    // 否则 token <> $2 对 NULL 求值为 NULL，一条都不会删。
    if (token) {
      await client.query(`DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2`, [
        uid,
        sessionTokenHash(token),
      ]);
    } else {
      await client.query(`DELETE FROM sessions WHERE user_id = $1`, [uid]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}