import { NextResponse } from "next/server";
import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import { guardInternalRequest } from "@/lib/internal-guard";
import { CONTENT_ROLES } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
import { listTopics, normalizeTopicPatch, updateTopic } from "@/lib/content/content-editor";

/**
 * /api/internal/content/topics —— 后台知识点管理。
 *
 *   GET   ?q=&track=&limit=&offset=                 列表（分页）
 *   PATCH { trackSlug, key, patch }                 改标题/摘要/概念/原理/应用/坑/方法/练习/检查点/讲义/状态
 *
 * 鉴权同题目接口；改完清内容缓存，前台下一跳即新内容。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await guardInternalRequest(req, "content-topics", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const params = new URL(req.url).searchParams;
  try {
    const result = await listTopics({
      q: params.get("q")?.trim() || undefined,
      track: params.get("track")?.trim() || undefined,
      limit: Number(params.get("limit")) || undefined,
      offset: Number(params.get("offset")) || undefined,
    });
    return NextResponse.json({ ok: true, requestId: guard.requestId, ...result });
  } catch (error) {
    return apiError(500, "知识点列表读取失败", { code: API_ERROR_CODES.internal_error, requestId: guard.requestId });
  }
}

export async function PATCH(req: Request) {
  const guard = await guardInternalRequest(req, "content-topics", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  const body = (await req.json().catch(() => null)) as { trackSlug?: unknown; key?: unknown; patch?: unknown } | null;
  const trackSlug = typeof body?.trackSlug === "string" ? body.trackSlug.trim() : "";
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!trackSlug || !key) {
    return apiError(400, "缺少 trackSlug 或 key", { code: API_ERROR_CODES.validation_failed, requestId });
  }

  const normalized = normalizeTopicPatch(body?.patch);
  if (!normalized.ok) return apiError(400, normalized.error, { code: API_ERROR_CODES.validation_failed, requestId });
  if (Object.keys(normalized.patch).length === 0) {
    return apiError(400, "没有需要修改的字段", { code: API_ERROR_CODES.validation_failed, requestId });
  }

  try {
    const result = await updateTopic(trackSlug, key, normalized.patch);
    if (!result.ok) {
      const notFound = result.error === "知识点不存在";
      return apiError(notFound ? 404 : 400, result.error, {
        code: notFound ? API_ERROR_CODES.not_found : API_ERROR_CODES.validation_failed,
        requestId,
      });
    }
    await writeAuditLog({
      action: "content.topic_update",
      actorId: guard.actorId,
      actorType: guard.actorType,
      targetType: "topic",
      targetId: trackSlug + "/" + key,
      meta: { fields: Object.keys(normalized.patch) },
      requestId,
      ip: guard.ip,
    });
    return NextResponse.json({ ok: true, trackSlug, key, fields: Object.keys(normalized.patch), requestId });
  } catch (error) {
    return apiError(500, "知识点更新失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}
