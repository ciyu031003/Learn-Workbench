import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/roadmap", "/tasks", "/logs", "/jobs", "/settings", "/trackers", "/habits", "/today"];

/** 匿名设备标识 cookie（未登录时隔离匿名数据，见 db/migrations/016_security_hardening.sql） */
const ANON_COOKIE = "lwb_anon";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 2026-10-18 S1-7：匿名标识改为**服务端签名**（HMAC-SHA256，base64url），
 * 客户端无法伪造别人的 anon_id 去读写其匿名数据。
 * 用 Web Crypto（Edge/Node 均可用），与服务端 lib/anon-cookie.ts 的 node:crypto 校验同算法。
 */
async function signAnonValue(uuid: string): Promise<string> {
  const secret = (process.env.ANON_COOKIE_SECRET || process.env.CRON_SECRET || "").trim();
  if (secret.length < 16) return uuid; // 本地未配密钥：保持旧行为（形态校验兜底）
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(uuid)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  const b64url = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return uuid + "." + b64url;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("lwb_session")?.value;

  if (pathname === "/login") {
    if (session) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return withAnonCookie(req, NextResponse.next());
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }
  return withAnonCookie(req, NextResponse.next());
}

/** 匿名访客首次访问时下发 lwb_anon 设备标识（一年有效，签名后 httpOnly） */
async function withAnonCookie(req: NextRequest, res: NextResponse): Promise<NextResponse> {
  const existing = req.cookies.get(ANON_COOKIE)?.value?.trim();
  // 已签名（含 "."）→ 保持不动；旧版未签名 UUID → 保留同一 uuid 重新签发（不丢匿名数据）
  if (existing && existing.includes(".")) return res;
  const legacyUuid = existing && UUID_RE.test(existing) ? existing : null;
  const uuid = legacyUuid ?? crypto.randomUUID();
  const value = await signAnonValue(uuid);
  res.cookies.set(ANON_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
