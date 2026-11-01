import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408KnowledgeMap } from "@/lib/exam-408-map";
import { logger } from "@/lib/logger";

/**
 * GET /api/exam/408/map —— 章节知识图谱（迁移 088）只读接口。
 *
 * 两种模式：
 *  - ?topic=<精读文章 slug>            → 按文章找它所属章节的图谱（阅读器用）
 *  - ?subject=<科目 key>&chapter=<章节> → 显式指定（App 章节入口用）
 *
 * 返回 { map: { key, subjectKey, subjectTitle, chapter, topicSlug, nodes, stats } }；
 * nodes 已含 href（精读页优先，缺 studySlug 时退回知识点页），客户端不需要再拼路由。
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const topic = params.get("topic")?.trim() ?? "";
  const subject = params.get("subject")?.trim() ?? "";
  const chapter = params.get("chapter")?.trim() ?? "";

  const hasTopic = params.has("topic");
  const hasSubject = params.has("subject");
  const hasChapter = params.has("chapter");

  if (hasTopic && (hasSubject || hasChapter)) {
    return apiError(400, "topic 与 subject/chapter 只能二选一", { code: API_ERROR_CODES.validation_failed });
  }
  if (!hasTopic && !hasSubject) {
    return apiError(400, "缺少 topic 或 subject+chapter 参数", { code: API_ERROR_CODES.validation_failed });
  }
  if (hasTopic && (!topic || topic.length > 300 || /[\u0000-\u001f]/.test(topic))) {
    return apiError(400, "topic 不合法", { code: API_ERROR_CODES.validation_failed });
  }
  if (hasSubject) {
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(subject)) {
      return apiError(400, "subject 不合法", { code: API_ERROR_CODES.validation_failed });
    }
    if (!chapter || chapter.length > 60 || /[\u0000-\u001f]/.test(chapter)) {
      return apiError(400, "subject 模式必须提供合法 chapter", { code: API_ERROR_CODES.validation_failed });
    }
  }

  try {
    const map = hasTopic
      ? await getExam408KnowledgeMap({ topicSlug: topic })
      : await getExam408KnowledgeMap({ subjectKey: subject, chapter });
    if (!map) {
      return apiError(404, "该章节暂无知识图谱", { code: API_ERROR_CODES.not_found });
    }
    return NextResponse.json({ map });
  } catch (error) {
    logger.error("exam 408 map error", error);
    return apiError(500, "408 知识图谱加载失败", { code: API_ERROR_CODES.internal_error });
  }
}
