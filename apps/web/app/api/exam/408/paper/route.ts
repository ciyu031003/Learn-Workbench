import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Paper } from "@/lib/exam-408";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return apiError(400, "year 必须是有效年份", {
      code: API_ERROR_CODES.validation_failed,
    });
  }

  try {
    const paper = await getExam408Paper(year);
    if (!paper) {
      return apiError(404, "该年份试卷不存在", {
        code: API_ERROR_CODES.not_found,
      });
    }
    return NextResponse.json(paper);
  } catch (error) {
    logger.error("exam 408 paper error", error);
    return apiError(500, "408 试卷加载失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}
