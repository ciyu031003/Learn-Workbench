import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { pointStatesForTrack } from "@/lib/content/point-states";
import { logger } from "@/lib/logger";

/**
 * GET /api/learning/point-states?track=<slug> —— 知识点五状态（组二 · 阶段 13 = Phase E）。
 *
 * 学习态是隐私：必须登录；未登录 401，前端退回"不显示状态"。
 * track 缺省取第一门（前端一般都会带）。
 */
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const trackSlug = new URL(req.url).searchParams.get("track") ?? "";
  if (!trackSlug) return NextResponse.json({ error: "缺少 track" }, { status: 400 });

  try {
    const result = await pointStatesForTrack(userId, trackSlug);
    if (!result) return NextResponse.json({ error: "课程不存在" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("learning point-states error", error);
    return NextResponse.json({ error: "状态加载失败" }, { status: 500 });
  }
}
