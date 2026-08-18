import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { listNotifications, unreadNotificationCount } from "@/lib/jobs";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") || 30) || 30));
  const [notifications, unread] = await Promise.all([
    listNotifications(userId, unreadOnly, limit),
    unreadNotificationCount(userId),
  ]);
  return NextResponse.json({ notifications, unread });
}
