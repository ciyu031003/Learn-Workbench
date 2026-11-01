import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Demo, getExam408Demos } from "@/lib/exam-408-demos";
import { logger } from "@/lib/logger";

/** demo key 沿用 408card 的 "408card/<subject>-<chapter>-<n>" 形态，允许字母数字与 . / _ - */
const DEMO_KEY_PATTERN = /^[A-Za-z0-9._/-]{1,160}$/;

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")?.trim() ?? "";

  if (!key) {
    try {
      return NextResponse.json({ list: await getExam408Demos() });
    } catch (error) {
      logger.error("exam 408 demos list error", error);
      return apiError(500, "408 演示目录加载失败", {
        code: API_ERROR_CODES.internal_error,
      });
    }
  }

  if (!DEMO_KEY_PATTERN.test(key)) {
    return apiError(400, "key 不合法", {
      code: API_ERROR_CODES.validation_failed,
    });
  }

  try {
    const demo = await getExam408Demo(key);
    if (!demo) {
      return apiError(404, "演示不存在", {
        code: API_ERROR_CODES.not_found,
      });
    }
    return NextResponse.json({ demo });
  } catch (error) {
    logger.error("exam 408 demo error", error);
    return apiError(500, "408 演示加载失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}
