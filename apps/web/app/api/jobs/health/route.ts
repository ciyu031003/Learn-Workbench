import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { sourceHealth } from "@/lib/jobs";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const source = url.searchParams.get("source")?.trim() || undefined;
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") || 14) || 14));
  const history = await sourceHealth(source, limit);
  return NextResponse.json({ history });
}
