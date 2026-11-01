import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import {
  getExam408StudyOverview,
  getExam408StudySubject,
  getExam408StudyTopic,
} from "@/lib/exam-408-study";
import { logger } from "@/lib/logger";

/**
 * GET /api/exam/408/study —— 408 精读（cs408.cloud 镜像）只读正文接口。
 *
 * 三种模式（与 Web 阅读器、App 阅读器共用同一份契约）：
 *  - 无参数          → 知识树总览：{ mode: "overview", source, stats, subjects }
 *  - ?subject=<slug> → 单科章节树：{ mode: "subject", source, subject }
 *  - ?slug=<slug>    → 单篇正文：  { mode: "topic", source, subject, topic, blocks, toc, excerpt, prev, next }
 *
 * 为什么正文直接在 API 里返回结构化 blocks：App 端不重写 Markdown 解析，
 * 两端渲染同一份「结构块」才能保证段落/表格/公式/插图一致；contentMd 也一并返回便于排查。
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const subject = params.get("subject")?.trim() ?? "";
  const slug = params.get("slug")?.trim() ?? "";

  if (subject && slug) {
    return apiError(400, "subject 与 slug 只能二选一", { code: API_ERROR_CODES.validation_failed });
  }
  if (params.has("slug") && !slug) {
    return apiError(400, "slug 不能为空", { code: API_ERROR_CODES.validation_failed });
  }
  if (slug.length > 300 || /[\u0000-\u001f]/.test(slug)) {
    return apiError(400, "slug 不合法", { code: API_ERROR_CODES.validation_failed });
  }
  if (subject && !/^[a-z][a-z0-9-]{1,40}$/.test(subject)) {
    return apiError(400, "subject 不合法", { code: API_ERROR_CODES.validation_failed });
  }

  try {
    if (slug) {
      const detail = await getExam408StudyTopic(slug);
      if (!detail) {
        return apiError(404, "精读文章不存在", { code: API_ERROR_CODES.not_found });
      }
      return NextResponse.json({ mode: "topic", ...detail });
    }

    if (subject) {
      const result = await getExam408StudySubject(subject);
      if (!result) {
        return apiError(404, "该科目暂无精读正文", { code: API_ERROR_CODES.not_found });
      }
      return NextResponse.json({ mode: "subject", ...result });
    }

    const overview = await getExam408StudyOverview();
    return NextResponse.json({ mode: "overview", ...overview });
  } catch (error) {
    logger.error("exam 408 study error", error);
    return apiError(500, "408 精读正文加载失败", { code: API_ERROR_CODES.internal_error });
  }
}
