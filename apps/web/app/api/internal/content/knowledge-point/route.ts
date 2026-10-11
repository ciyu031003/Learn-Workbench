import { NextResponse } from "next/server";
import { API_ERROR_CODES, apiError } from "@/lib/api-error";
import { guardInternalRequest } from "@/lib/internal-guard";
import { CONTENT_ROLES } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
import {
  getKnowledgePoint,
  normalizeKnowledgePointPatch,
  updateKnowledgePoint,
} from "@/lib/content/knowledge-point-write";

/**
 * 知识点编辑接口（组三 · H1 收口：乐观锁写入路径）。
 *
 * 鉴权：`x-cron-secret` 或具备内容角色（admin/editor/reviewer）的会话，见 lib/internal-guard.ts。
 *
 * - `GET  ?key=<knowledgePointKey>`：读当前快照（含 `version`，编辑前拿基线）；
 * - `POST { key, expectedVersion, title?, summary?, status?, tags? }`：
 *   乐观锁写入——`version` 不匹配即 409，绝不静默覆盖别人的修改。
 *
 * 这里是**数据层与契约**；可视化编辑入口另行排期（看板口径），因此接口按内部密钥/内容角色收紧。
 */
export async function GET(req: Request) {
  const guard = await guardInternalRequest(req, "content-knowledge-point", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  const key = (new URL(req.url).searchParams.get("key") ?? "").trim();
  if (!key) return apiError(400, "缺少 key 查询参数", { code: API_ERROR_CODES.validation_failed, requestId });

  try {
    const point = await getKnowledgePoint(key);
    if (!point) return apiError(404, "知识点不存在（先跑内容同步登记）", { code: API_ERROR_CODES.not_found, requestId });
    return NextResponse.json({ ...point, requestId });
  } catch {
    return apiError(500, "知识点读取失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}

export async function POST(req: Request) {
  const guard = await guardInternalRequest(req, "content-knowledge-point", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return apiError(400, "缺少知识点 key", { code: API_ERROR_CODES.validation_failed, requestId });

  const expectedVersion = Number(body?.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return apiError(400, "expectedVersion 必须是 >= 1 的整数（先 GET 取当前 version）", {
      code: API_ERROR_CODES.validation_failed,
      requestId,
    });
  }

  const normalized = normalizeKnowledgePointPatch(body);
  if (!normalized.ok) {
    return apiError(400, normalized.message, { code: API_ERROR_CODES.validation_failed, requestId });
  }

  try {
    const result = await updateKnowledgePoint({
      key,
      expectedVersion,
      patch: normalized.patch,
      actorId: guard.actorId,
    });

    if (!result.ok && result.reason === "not_found") {
      return apiError(404, "知识点不存在（先跑内容同步登记）", { code: API_ERROR_CODES.not_found, requestId });
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "版本冲突：知识点已被他人修改，请重新读取后再提交",
          code: API_ERROR_CODES.conflict,
          requestId,
          currentVersion: result.currentVersion,
        },
        { status: 409 }
      );
    }

    await writeAuditLog({
      action: "content.knowledge_point_update",
      actorId: guard.actorId,
      actorType: guard.actorType,
      targetType: "knowledge_point",
      targetId: key,
      meta: { expectedVersion, nextVersion: result.version, fields: Object.keys(normalized.patch) },
      requestId,
      ip: guard.ip,
    });

    return NextResponse.json({ ok: true, key, version: result.version, requestId });
  } catch {
    return apiError(500, "知识点更新失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}
