import { isSecureRequest } from "@/lib/session";
import { NextResponse } from "next/server";
import {
  WECHAT_STATE_COOKIE,
  WECHAT_STATE_MAX_AGE_SECONDS,
  buildQrConnectUrl,
  createStateWithNonce,
  isWechatEnabled,
  wechatRedirectUri,
} from "@/lib/wechat";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";


/** 生成微信扫码授权链接（code 由微信回跳到 /login 时携带） */
export async function GET(req: Request) {
  if (!isWechatEnabled()) {
    return NextResponse.json({ error: "微信登录未配置" }, { status: 503 });
  }
  // S2-5：接口匿名可铸造 state → 按 IP 限流，压低批量刷 state / 探测成本
  const throttle = await rateLimit(`wechat-qrcode:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!throttle.ok) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds },
      { status: 429 }
    );
  }

  const created = createStateWithNonce();
  if (!created) return NextResponse.json({ error: "微信登录未配置" }, { status: 503 });
  const url = buildQrConnectUrl(wechatRedirectUri(req), created.state);
  const res = NextResponse.json({ url, state: created.state });
  // 一次性 nonce 随 state 下发：HttpOnly 短 cookie，callback 必须带回才能兑换
  res.cookies.set(WECHAT_STATE_COOKIE, created.nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WECHAT_STATE_MAX_AGE_SECONDS,
    secure: isSecureRequest(),
  });
  return res;
}
