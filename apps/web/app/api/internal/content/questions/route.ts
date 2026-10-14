import { NextResponse } from "next/server";
import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { guardInternalRequest } from "@/lib/internal-guard";
import { CONTENT_ROLES } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
import { listQuestions, normalizeQuestionPatch, updateQuestion } from "@/lib/content/content-editor";

/**
 * /api/internal/content/questions —— 后台题目管理（075 之后题目在库里，改完前台立即生效）。
 *
 *   GET  ?q=&track=&status=&level=&limit=&offset=   列表（分页）
 *   PATCH { key, patch }                            改题干/选项/答案/解析/标签/难度/分级/题型/状态
 *
 * 鉴权：x-cron-secret 或内容角色会话（admin/editor/reviewer）。
 * 校验：按"库里现有值 + patch"合并后的整行校验，保证 选项/答案/题型 永远自洽。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await guardInternalRequest(req, "content-questions", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const params = new URL(req.url).searchParams;
  try {
    const result = await listQuestions({
      q: params.get("q")?.trim() || undefined,
      track: params.get("track")?.trim() || undefined,
      status: params.get("status")?.trim() || undefined,
      level: params.get("level")?.trim() || undefined,
      limit: Number(params.get("limit")) || undefined,
      offset: Number(params.get("offset")) || undefined,
    });
    return NextResponse.json({ ok: true, requestId: guard.requestId, ...result });
  } catch (error) {
    return apiError(500, "题目列表读取失败", { code: API_ERROR_CODES.internal_error, requestId: guard.requestId });
  }
}

export async function PATCH(req: Request) {
  const guard = await guardInternalRequest(req, "content-questions", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  const body = (await req.json().catch(() => null)) as { key?: unknown; patch?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return apiError(400, "缺少题目 key", { code: API_ERROR_CODES.validation_failed, requestId });

  const normalized = normalizeQuestionPatch(body?.patch);
  if (!normalized.ok) return apiError(400, normalized.error, { code: API_ERROR_CODES.validation_failed, requestId });
  if (Object.keys(normalized.patch).length === 0) {
    return apiError(400, "没有需要修改的字段", { code: API_ERROR_CODES.validation_failed, requestId });
  }

  try {
    const result = await updateQuestion(key, normalized.patch);
    if (!result.ok) {
      const notFound = result.error === "题目不存在";
      return apiError(notFound ? 404 : 400, result.error, {
        code: notFound ? API_ERROR_CODES.not_found : API_ERROR_CODES.validation_failed,
        requestId,
      });
    }
    await writeAuditLog({
      action: "content.question_update",
      actorId: guard.actorId,
      actorType: guard.actorType,
      targetType: "question",
      targetId: key,
      meta: { fields: Object.keys(normalized.patch) },
      requestId,
      ip: guard.ip,
    });
    return NextResponse.json({ ok: true, key, fields: Object.keys(normalized.patch), requestId });
  } catch (error) {
    return apiError(500, "题目更新失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}
