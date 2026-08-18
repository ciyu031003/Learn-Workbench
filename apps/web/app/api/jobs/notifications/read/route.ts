import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/jobs";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (id == null || id === "all") {
    await markAllNotificationsRead(userId);
    return NextResponse.json({ ok: true, all: true });
  }
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效通知 ID" }, { status: 400 });
  }
  await markNotificationRead(userId, num);
  return NextResponse.json({ ok: true, id: num });
}
