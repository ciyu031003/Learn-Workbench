import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import {
  SEARCH_MAX_QUERY_LENGTH,
  buildExam408SearchResult,
  isSearchQueryTooLong,
  normalizeSearchQuery,
  searchExam408,
} from "@/lib/exam-408-search";
import { logger } from "@/lib/logger";

/**
 * GET /api/exam/408/search?q=死锁
 *
 * 408 专区全局搜索（P5）：知识点 / 精读 / 速记卡 / 真题 四类内容。
 * - q 缺失或去空白后为空：直接返回空结果（不查库）；
 * - q 超过 SEARCH_MAX_QUERY_LENGTH：400，避免超长 ILIKE 拖慢查询；
 * - 其他异常统一 500，不裸抛数据库错误。
 * 搜索结果按请求实时计算，禁止 CDN/浏览器缓存。
 */
export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q"));

  if (!query) {
    return NextResponse.json(buildExam408SearchResult(""), {
      headers: { "cache-control": "no-store" },
    });
  }
  if (isSearchQueryTooLong(query)) {
    return apiError(400, "搜索词最多 " + SEARCH_MAX_QUERY_LENGTH + " 个字符", {
      code: API_ERROR_CODES.validation_failed,
    });
  }

  try {
    const result = await searchExam408(query);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("exam 408 search error", error);
    return apiError(500, "408 搜索失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}
