import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

/** 重置密码：一次性令牌，30 分钟内有效 */
export async function POST(req: Request) {
  const throttle = rateLimit(`reset:${clientIp(req)}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!throttle.ok) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  const parsed = await parseBody(req, 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const token = String(body.token ?? "").trim();
  const newPassword = String(body.newPassword ?? "");
  if (!token) return NextResponse.json({ error: "缺少重置令牌" }, { status: 400 });
  if (newPassword.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [token]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "重置链接无效或已过期" }, { status: 400 });
    }
    const userId = rows[0].user_id;
    const { rows: acc } = await client.query("SELECT 1 FROM accounts WHERE user_id = $1", [userId]);
    if (acc[0]) {
      await client.query("UPDATE accounts SET password_hash = $1 WHERE user_id = $2", [
        await hashPassword(newPassword),
        userId,
      ]);
    } else {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "该账号未设置密码登录，无法重置" }, { status: 400 });
    }
    // 令牌作废 + 全端下线
    await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE token = $1", [token]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
