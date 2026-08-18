import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { listUpcomingExamEvents } from "@/lib/jobs";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") || 30) || 30));
  const events = await listUpcomingExamEvents(limit);
  return NextResponse.json({ events });
}
