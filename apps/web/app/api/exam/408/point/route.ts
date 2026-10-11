import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Point } from "@/lib/exam-408";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  if (!key.startsWith("beokayy-408/")) {
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
