import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { learningReviewQueue } from "@/lib/learning";
import { logger } from "@/lib/logger";

/** GET /api/learning/review —— 到期复习队列（reading learning_review_cards，SM-2 由作答接口维护） */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    return NextResponse.json(await learningReviewQueue(userId));
  } catch (error) {
    logger.error("learning review error", error);
    return NextResponse.json({ error: "复习队列加载失败" }, { status: 500 });
  }
}
