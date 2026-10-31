import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { pgPool } from "@/lib/db";
import { parseBody, siteOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";
import { isEmailSendingConfigured, sendResetEmail } from "@/lib/wechat";

/**
 * 忘记密码： Always-200 防枚举。
 * 实际发信依赖 EMAIL_API_KEY（Resend）；未配置时返回 ok:false + reason，前端给引导文案。
 */
export async function POST(req: Request) {
  const throttle = await rateLimit(`forgot:${clientIp(req)}`, { limit: 5, windowMs: 60 * 60_000 });
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
  // P1 fail-closed（评审 2026-10-31）：生产必须显式配置 WEB_BASE_URL 才发信——
  // siteOrigin 的代理头回落会让携带有效 token 的重置链接被 X-Forwarded-Host 投毒到
  // 攻击者域（nginx 只覆盖 Host/X-Real-IP/XFF，不覆盖 X-Forwarded-Host）。
  if (process.env.NODE_ENV === "production" && !process.env.WEB_BASE_URL?.trim()) {
    return NextResponse.json({ ok: false, reason: "WEB_BASE_URL_UNCONFIGURED" });
  }

  const { rows } = await pgPool.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
    [email]
  );
  if (rows[0]) {
    const token = randomBytes(24).toString("hex");
    // P3（评审 2026-10-31）：库里只存 sha256(token)——DB/备份泄露不再直接得到可用
    // 重置凭证；明文 token 只出现在邮件链接里（与 session token 只存哈希同一口径）。
    // 注意：切换瞬间旧格式（未哈希）的存量 token 会失效，TTL 30 分钟影响可忽略。
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await pgPool.query(
      "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 minutes')",
      [tokenHash, rows[0].id]
    );
    // P0：链接域名走固定配置/代理头（siteOrigin），不再信任 Origin 头，防重置链接投毒
    await sendResetEmail(email, `${siteOrigin(req)}/login?reset=${token}`);
  }
  return NextResponse.json({ ok: true });
}
