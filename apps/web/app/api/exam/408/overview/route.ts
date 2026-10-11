import { NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Overview } from "@/lib/exam-408";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    return NextResponse.json(await getExam408Overview());
  } catch (error) {
    logger.error("exam 408 overview error", error);
    return apiError(500, "408 题库加载失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}
