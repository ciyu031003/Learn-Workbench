import { NextResponse } from "next/server";
import { learningSchedulerActionSchema } from "@learn-workbench/shared";
import { API_ERROR_CODES, apiError } from "@/lib/api-error";
import { parseBody } from "@/lib/http";
import { learningSchedulerStatus, setLearningSchedulerMode } from "@/lib/learning-scheduler";
import { logger } from "@/lib/logger";
import { requestIdFrom } from "@/lib/request-id";
import { currentUserId } from "@/lib/session";

function readTrackSlug(req: Request): { ok: true; trackSlug?: string } | { ok: false } {
  const url = new URL(req.url);
  const raw = url.searchParams.get("track") ?? url.searchParams.get("trackSlug");
  if (raw === null || raw === "") return { ok: true };
  const trackSlug = raw.trim();
  if (trackSlug.length < 1 || trackSlug.length > 80) return { ok: false };
  return { ok: true, trackSlug };
}

/** GET /api/learning/scheduler?track= —— 当前调度模式 + 7/14/30 天 SM-2 / FSRS 到期差异评估。 */
export async function GET(req: Request) {
  const requestId = requestIdFrom(req);
  const userId = await currentUserId();
  if (!userId) {
    return apiError(401, "请先登录", { code: API_ERROR_CODES.unauthorized, requestId });
  }
  const track = readTrackSlug(req);
  if (!track.ok) {
    return apiError(400, "track 参数无效", { code: API_ERROR_CODES.validation_failed, requestId });
  }
  try {
    return NextResponse.json(await learningSchedulerStatus(userId, track.trackSlug));
  } catch (error) {
    logger.error("learning scheduler status error", error, requestId);
    return apiError(500, "调度评估加载失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}

/** PATCH /api/learning/scheduler —— 打开 / 关闭 FSRS 影子双跑；目标状态幂等。 */
export async function PATCH(req: Request) {
  const requestId = requestIdFrom(req);
  const userId = await currentUserId();
  if (!userId) {
    return apiError(401, "请先登录", { code: API_ERROR_CODES.unauthorized, requestId });
  }
  const parsedBody = await parseBody(req, 16 * 1024);
  if (!parsedBody.ok) {
    return apiError(parsedBody.status, parsedBody.error, {
      code: API_ERROR_CODES.validation_failed,
      requestId,
    });
  }
  const parsed = learningSchedulerActionSchema.safeParse(parsedBody.data ?? {});
  if (!parsed.success) {
    return apiError(400, "调度器操作无效", { code: API_ERROR_CODES.validation_failed, requestId });
  }
  try {
    return NextResponse.json(await setLearningSchedulerMode(userId, parsed.data));
  } catch (error) {
    logger.error("learning scheduler mutation error", error, requestId);
    return apiError(500, "调度器设置失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}
