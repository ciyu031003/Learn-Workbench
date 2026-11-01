import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Topic } from "@/lib/exam-408-topic";
import { internalizePointKey, isExam408PointKey } from "@/lib/exam-408-point-key";
import { logger } from "@/lib/logger";

/**
 * GET /api/exam/408/topic?key=beokayy-408/<subject>-<chapter>-<point>
 *
 * 聚合页数据源：一次返回该知识点正文 + 精读文章 + 速记卡 + 演示 + 真题。
 * 四个数组可能为空（新入库的科目可能还没有文章/卡/演示），前端按 section 兜底即可。
 */
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
    const topic = await getExam408Topic(key);
    if (!topic) {
      return apiError(404, "知识点不存在", {
        code: API_ERROR_CODES.not_found,
      });
    }
    return NextResponse.json(topic);
  } catch (error) {
    logger.error("exam 408 topic error", error);
    return apiError(500, "408 知识点聚合加载失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}