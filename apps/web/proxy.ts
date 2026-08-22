import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/roadmap", "/tasks", "/logs", "/jobs", "/settings"];

/** 匿名设备标识 cookie（未登录时隔离匿名数据，见 db/migrations/016_security_hardening.sql） */
const ANON_COOKIE = "lwb_anon";

export function proxy(req: NextRequest) {
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

/** 匿名访客首次访问时下发 lwb_anon 设备标识（一年有效） */
function withAnonCookie(req: NextRequest, res: NextResponse): NextResponse {
  if (req.cookies.get(ANON_COOKIE)?.value) return res;
  res.cookies.set(ANON_COOKIE, crypto.randomUUID(), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};