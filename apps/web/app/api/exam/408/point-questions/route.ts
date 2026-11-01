import { NextRequest, NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { getExam408Point } from "@/lib/exam-408";
import { internalizePointKey } from "@/lib/exam-408-point-key";
import { logger } from "@/lib/logger";

/**
 * GET /api/exam/408/point-questions?key=beokayy-408/os-02-04&year=2021
 *
 * P7：知识点聚合页的真题按年懒加载。首屏只渲染「年份 + 题数 + 分值」折叠头，
 * 展开某年时才请求本接口拿该年题目（复用 lib/exam-408 的题目映射，不重复实现行转换）。
 *
 * 契约：{ key, year, total, questions: Exam408Question[] }（当年按题号升序）
 * 400：key 形状不对 / year 不是 2000-2100 的整数；404：知识点不存在；500：数据库异常。
 * 缓存：内容只读，允许浏览器私有缓存；不做共享 CDN 缓存（来源许可为个人学习自用）。
 */

/** 408 知识点 key 的形状（ds/co/os/cn + 两位章号 + 两位点号）。 */
const POINT_KEY_RE = /^(?:beokayy|yuanabd)-408\/(ds|co|os|cn)-\d{2}-\d{2}$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * key 规范化（等价于 internalize）：URL 解码、去首尾空白、折叠重复斜杠，
 * 再交给形状校验。客户端可能传来 %2F 编码的整串 key。
 */
export function normalizePointKey(raw: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  return decoded.replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").trim();
}

export function parseQuestionYear(raw: string | null): number | null {
  if (raw === null) return null;
  const value = raw.trim();
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const key = normalizePointKey(params.get("key"));
  if (!POINT_KEY_RE.test(key)) {
    return apiError(400, "key 必须是 408 知识点 key（beokayy-408/<科目>-<章>-<点>）", {
      code: API_ERROR_CODES.validation_failed,
    });
  }
  const year = parseQuestionYear(params.get("year"));
  if (year === null) {
    return apiError(400, "year 必须是 " + MIN_YEAR + "-" + MAX_YEAR + " 的年份", {
      code: API_ERROR_CODES.validation_failed,
    });
  }

  try {
    const detail = await getExam408Point(internalizePointKey(key));
    if (!detail) {
      return apiError(404, "知识点不存在", {
        code: API_ERROR_CODES.not_found,
      });
    }
    const questions = detail.questions
      .filter((question) => Number(question.year) === year)
      .sort((left, right) => left.number - right.number);
    return NextResponse.json(
      { key, year, total: questions.length, questions },
      { headers: { "cache-control": "private, max-age=300" } },
    );
  } catch (error) {
    logger.error("exam 408 point questions error", error);
    return apiError(500, "408 知识点真题加载失败", {
      code: API_ERROR_CODES.internal_error,
    });
  }
}
