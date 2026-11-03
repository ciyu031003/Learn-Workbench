import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Question } from "@/lib/exam-408";
import { logger } from "@/lib/logger";

/**
 * GET /api/exam/408/question?key=<set question key>
 *
 * P3-1：单道真题详情（App 真题详情页，也供 Web 后续复用）。
 * - 400：key 缺失或超长（题 key 形如 beokayy-408/2021/12，不超过 200 字符）；
 * - 404：题目不存在或未发布；
 * - 500：数据库异常，不裸抛。
 * 缓存：内容只读，允许浏览器私有缓存（与 point-questions 同口径），不做共享 CDN 缓存。
 */

const MAX_QUESTION_KEY_LENGTH = 200;

function readKey(value: string | null): string {
  return (value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const key = readKey(request.nextUrl.searchParams.get("key"));
  if (!key || key.length > MAX_QUESTION_KEY_LENGTH) {
    return apiError(400, "key 必须是 408 真题 key", {
      code: API_ERROR_CODES.validation_failed,
    });
  }

  try {
    const question = await getExam408Question(key);
    if (!question) {
      return apiError(404, "真题不存在", { code: API_ERROR_CODES.not_found });
    }
    return NextResponse.json(
      { question },
      { headers: { "cache-control": "private, max-age=300" } },
    );
  } catch (error) {
    logger.error("exam 408 question detail error", error);
    return apiError(500, "408 真题加载失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}
