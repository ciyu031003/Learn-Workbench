import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentSessionToken, currentUserId } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const current = String(body?.currentPassword ?? "");
  const next = String(body?.newPassword ?? "");
  if (!current) return NextResponse.json({ error: "请输入当前密码" }, { status: 400 });
  if (next.length < 6) return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 });

  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { rows } = await pgPool.query<{ password_hash: string }>(
    `SELECT password_hash FROM accounts WHERE user_id = $1`,
    [uid]
  );
  const account = rows[0];
  if (!account || !verifyPassword(current, account.password_hash)) {
    return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
  }

  const hash = hashPassword(next);
  const token = await currentSessionToken();
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE accounts SET password_hash = $1 WHERE user_id = $2`, [hash, uid]);
    // 修改密码后使其他会话失效，保留当前登录
    if (token) {
      await client.query(`DELETE FROM sessions WHERE user_id = $1 AND token <> $2`, [uid, token]);
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
