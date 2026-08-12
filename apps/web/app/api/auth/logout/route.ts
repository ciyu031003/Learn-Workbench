import { NextResponse } from "next/server";
import { destroySession, sessionCookieName } from "@/lib/session";

export async function POST(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${sessionCookieName}=([^;]+)`));
  const token = match?.[1];
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
