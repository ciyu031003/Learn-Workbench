import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Point } from "@/lib/exam-408";
import { internalizePointKey, isExam408PointKey } from "@/lib/exam-408-point-key";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const rawKey = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  // P7：对外用 yuanabd-408/*，库内主键仍是 beokayy-408/*；旧前缀继续兼容
  const key = internalizePointKey(rawKey);
  if (!isExam408PointKey(rawKey)) {
    return apiError(400, "key 必须是 408 知识点 key", {
      code: API_ERROR_CODES.validation_failed,
    });
  }

  try {
    const point = await getExam408Point(key);
    if (!point) {
      return apiError(404, "知识点不存在", {
        code: API_ERROR_CODES.not_found,
      });
    }
    return NextResponse.json(point);
  } catch (error) {
    logger.error("exam 408 point error", error);
    return apiError(500, "408 知识点加载失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}