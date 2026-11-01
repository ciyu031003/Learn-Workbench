import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import {
  getExam408StudyOverview,
  getExam408StudySubject,
  getExam408StudyTopic,
} from "@/lib/exam-408-study";
import { addMathToBlocks } from "@/lib/tex-svg";
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
 *
 * ?format=svg（或 ?math=svg，v1.55 / P7）：只对 ?slug= 模式生效，在 blocks 上追加公式渲染结果
 *   - math 块追加 svg（display 模式的服务端 TeX→SVG）；
 *   - paragraph / list / table / quote 追加 segments（text/math 段），App 直接按段渲染；
 *   Web 阅读页仍按原字段用 KaTeX 渲染，**默认格式完全不变**（不传该参数时响应体与 1.54 一致）。
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const subject = params.get("subject")?.trim() ?? "";
  const slug = params.get("slug")?.trim() ?? "";
  /** ?format=svg / ?math=svg：把公式在服务端渲染成 SVG 后随 blocks 返回（仅 App 用） */
  const wantsMathSvg =
    (params.get("format")?.trim().toLowerCase() ?? "") === "svg" ||
    (params.get("math")?.trim().toLowerCase() ?? "") === "svg";

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
      if (wantsMathSvg) {
        // 公式渲染失败只让该条 svg 为 null，不影响整篇正文返回（App 回退等宽文本）
        const blocks = addMathToBlocks(detail.blocks);
        return NextResponse.json({ mode: "topic", ...detail, blocks });
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
