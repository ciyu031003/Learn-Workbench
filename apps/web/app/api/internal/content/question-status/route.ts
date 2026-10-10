import { NextResponse } from "next/server";
import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { guardInternalRequest } from "@/lib/internal-guard";
import { CONTENT_ROLES } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
import { isQuestionStatus, setQuestionStatus } from "@/lib/content/question-lifecycle";

/**
 * POST /api/internal/content/question-status —— 改题目生命周期状态（组二 · 阶段 12 剩余）。
 *
 * 鉴权：x-cron-secret 或具备内容角色（admin/editor/reviewer）的会话，见 lib/internal-guard.ts。
 * body：{ key: string, status: "draft"|"review"|"published"|"archived" }
 *
 * 为什么不做物理删除：历史作答（learning_attempts）与复习卡片都引用 question_key，
 * 下线只改状态，保留可追溯性。
 */
export async function POST(req: Request) {
  const guard = await guardInternalRequest(req, "content-question-status", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  const body = (await req.json().catch(() => null)) as { key?: unknown; status?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return apiError(400, "缺少题目 key", { code: API_ERROR_CODES.validation_failed, requestId });
  if (!isQuestionStatus(body?.status)) {
    return apiError(400, "状态必须是 draft / review / published / archived", {
      code: API_ERROR_CODES.validation_failed,
      requestId,
    });
  }

  try {
    const ok = await setQuestionStatus(key, body.status);
    if (!ok) return apiError(404, "题目不存在（先跑内容同步登记）", { code: API_ERROR_CODES.not_found, requestId });
    await writeAuditLog({
      action: "content.question_status",
      actorId: guard.actorId,
      actorType: guard.actorType,
      targetType: "question",
      targetId: key,
      meta: { status: body.status },
      requestId,
      ip: guard.ip,
    });
    return NextResponse.json({ ok: true, key, status: body.status, requestId });
  } catch (error) {
    return apiError(500, "题目状态更新失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}
