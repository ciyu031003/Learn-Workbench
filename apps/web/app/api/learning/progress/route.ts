import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { learningProgress } from "@/lib/learning";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const trackSlug = new URL(req.url).searchParams.get("track") ?? undefined;
  try {
    return NextResponse.json(await learningProgress(userId, trackSlug));
  } catch (error) {
    logger.error("learning progress error", error);
    return NextResponse.json({ error: "练习记录加载失败" }, { status: 500 });
  }
}

