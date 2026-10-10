import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { learningLibraryState } from "@/lib/learning-read";
import { logger } from "@/lib/logger";

/**
 * GET /api/learning/library-state?track=python
 * 跨设备拉取阅读状态 + 收藏（Web 上看得到手机上读过的、收藏的）。
 */
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const trackSlug = new URL(req.url).searchParams.get("track") ?? undefined;
  try {
    return NextResponse.json(await learningLibraryState(userId, trackSlug ?? undefined));
  } catch (error) {
    logger.error("learning library state error", error);
    return NextResponse.json({ error: "阅读状态加载失败" }, { status: 500 });
  }
}
