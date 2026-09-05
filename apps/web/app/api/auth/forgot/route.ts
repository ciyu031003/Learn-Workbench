import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { pgPool } from "@/lib/db";
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";
import { isEmailSendingConfigured, sendResetEmail } from "@/lib/wechat";

/**
 * 忘记密码： Always-200 防枚举。
 * 实际发信依赖 EMAIL_API_KEY（Resend）；未配置时返回 ok:false + reason，前端给引导文案。
 */
export async function POST(req: Request) {
  const throttle = rateLimit(`forgot:${clientIp(req)}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!throttle.ok) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  const parsed = await parseBody(req, 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const email = String((parsed.data as Record<string, unknown> | null)?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  }

  if (!isEmailSendingConfigured()) {
    return NextResponse.json({ ok: false, reason: "EMAIL_UNCONFIGURED" });
  }

  const { rows } = await pgPool.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
    [email]
  );
  if (rows[0]) {
    const token = randomBytes(24).toString("hex");
    await pgPool.query(
      "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 minutes')",
      [token, rows[0].id]
    );
    const origin = new URL(req.headers.get("origin") ?? req.url).origin;
    await sendResetEmail(email, `${origin}/login?reset=${token}`);
  }
  return NextResponse.json({ ok: true });
}
