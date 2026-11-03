import { NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import {
  createPaperAttempt,
  listPaperAttempts,
  normalizePaperAttemptInput,
} from "@/lib/exam-408-paper-attempts";
import { logger } from "@/lib/logger";
import { currentUserId } from "@/lib/session";

/**
 * 408 套卷历史成绩 API（Web + App 共用，P3-2A）。
 *
 * GET  /api/exam/408/paper-attempts?limit=20
 *   -> 200 { attempts: [...], total }（submitted_at DESC, id DESC；limit 默认 20 / clamp 1..50）
 * POST /api/exam/408/paper-attempts
 *   body { year, score, totalScore, correct, wrong, unanswered,
 *          durationSeconds: number|null, startedAt: string|null, submittedAt: string,
 *          byPoint: [{ key, title, wrong, total }], bySubject: [...] }
 *   -> 201 { attempt }
 *
 * 数据隔离：一律 currentUserId()，读写都按 user_id 过滤；未登录 401。
 * 校验：纯函数 normalizePaperAttemptInput 负责（结构非法 400，条目脏项丢弃）；
 * 错误体统一 { error, code? }（见 lib/api-error.ts）。
 */

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return apiError(401, "请先登录", { code: API_ERROR_CODES.unauthorized });

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const parsedLimit = rawLimit === null ? undefined : Number(rawLimit);
  // 非法（NaN）交给纯函数按默认值处理，路由不重复实现 clamp 规则
  const limit = parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  try {
    return NextResponse.json(await listPaperAttempts(userId, { limit }));
  } catch (error) {
    logger.error("exam 408 paper attempts list error", error);
    return apiError(500, "套卷成绩加载失败", { code: API_ERROR_CODES.internal_error });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return apiError(401, "请先登录", { code: API_ERROR_CODES.unauthorized });

  const raw = await request.json().catch(() => null);
  const parsed = normalizePaperAttemptInput(raw);
  if (!parsed.ok) {
    return apiError(400, parsed.error, { code: API_ERROR_CODES.validation_failed });
  }

  try {
    return NextResponse.json({ attempt: await createPaperAttempt(userId, parsed.value) }, { status: 201 });
  } catch (error) {
    logger.error("exam 408 paper attempt create error", error);
    return apiError(500, "套卷成绩保存失败", { code: API_ERROR_CODES.internal_error });
  }
}
