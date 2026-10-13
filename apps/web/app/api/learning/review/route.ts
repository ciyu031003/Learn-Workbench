import { NextResponse } from "next/server";
import { learningReviewActionSchema } from "@learn-workbench/shared";
import { currentUserId } from "@/lib/session";
import { learningReviewQueue, mutateLearningReview } from "@/lib/learning";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/** GET /api/learning/review —— 复习计划；默认到期队列，scope=all 用于计划管理。 */
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return apiError(401, "请先登录", { code: "unauthorized" });
  try {
    const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "due";
    return NextResponse.json(await learningReviewQueue(userId, new Date(), scope));
  } catch (error) {
    logger.error("learning review error", error);
    return apiError(500, "复习队列加载失败", { code: "internal_error" });
  }
}

/** PATCH /api/learning/review —— 延后 / 暂停 / 恢复 / 完成，clientId 保证离线重放幂等。 */
export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return apiError(401, "请先登录", { code: "unauthorized" });
  const body = await req.json().catch(() => null);
  const parsed = learningReviewActionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError(400, "复习计划操作无效", { code: "validation_failed" });
  }
  try {
    return NextResponse.json(await mutateLearningReview(userId, parsed.data));
  } catch (error) {
    logger.error("learning review mutation error", error);
    return apiError(500, "复习计划更新失败", { code: "internal_error" });
  }
}
