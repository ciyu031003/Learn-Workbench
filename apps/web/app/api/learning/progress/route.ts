import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { learningProgress } from "@/lib/learning";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return apiError(401, "请先登录", { code: "unauthorized" });
  const url = new URL(req.url);
  const trackSlug = url.searchParams.get("track") ?? undefined;
  const timeZone = req.headers.get("x-timezone") ?? undefined;
  try {
    return NextResponse.json(await learningProgress(userId, trackSlug, new Date(), timeZone));
  } catch (error) {
    logger.error("learning progress error", error);
    return apiError(500, "练习记录加载失败", { code: "internal_error" });
  }
}

