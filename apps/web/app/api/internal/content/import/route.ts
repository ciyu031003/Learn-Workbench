import { NextResponse } from "next/server";
import {
  ContentImportError,
  rollbackContentImport,
  runContentImport,
  type ContentImportItemInput,
} from "@/lib/content/import-pipeline";
import { logger } from "@/lib/logger";
import { apiError, API_ERROR_CODES, type ApiErrorCode } from "@/lib/api-error";
import { guardInternalRequest } from "@/lib/internal-guard";
import { CONTENT_ROLES } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
import { inc, timed } from "@/lib/metrics";

/** ContentImportError.status → 错误码（H2：状态码之外再给机器可读类型）。 */
function importErrorCode(status: number): ApiErrorCode {
  if (status === 404) return API_ERROR_CODES.not_found;
  if (status === 409) return API_ERROR_CODES.conflict;
  if (status === 401 || status === 403) return API_ERROR_CODES.forbidden;
  return API_ERROR_CODES.validation_failed;
}

/**
 * POST /api/internal/content/import —— 内容导入管线（组二 · 阶段 10 = V3 纵线 Phase F）。
 *
 * 鉴权：x-cron-secret == CRON_SECRET（与 cron / 内容同步 / 面试导入同款）。
 * body：
 *   { sourceKey, mode: "dry-run" | "apply", commitSha?, scope?: string[], items?: [...], createdBy? }
 *   { rollback: batchId }  —— 只软归档该批次新建的 review 草稿，批次标记 rolled-back
 *
 * 硬约束：导入物化一律 status='review'；目标键已是 published 的条目改判 conflict(target-published)；
 *        usage='reference' 的来源只允许 dry-run。冲突/失败不回滚整批（要落明细给人工看）。
 */
export async function POST(req: Request) {
  // H2：内部接口统一前门（先限流再验密钥），见 lib/internal-guard.ts。
  const guard = await guardInternalRequest(req, "content-import", { allowRoles: CONTENT_ROLES });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  const body = (await req.json().catch(() => null)) as {
    sourceKey?: unknown;
    mode?: unknown;
    commitSha?: unknown;
    scope?: unknown;
    items?: unknown;
    createdBy?: unknown;
    rollback?: unknown;
  } | null;

  // H5：dry-run 与 apply 分开计数，成功率按 mode 分桶；mode 提到 try 外以便 catch 里也能打点。
  let mode: "dry-run" | "apply" = "dry-run";

  try {
    const rollbackId = Number(body?.rollback);
    if (Number.isInteger(rollbackId) && rollbackId > 0) {
      const result = await rollbackContentImport(rollbackId);
      logger.info("[internal/content/import] rolled back:", JSON.stringify(result));
      await writeAuditLog({
        action: "content.import.rollback",
        actorId: guard.actorId,
        actorType: guard.actorType,
        targetType: "content_import_batch",
        targetId: String(rollbackId),
        meta: { ...result },
        requestId,
        ip: guard.ip,
      });
      return NextResponse.json({ ok: true, rollback: true, requestId, ...result });
    }

    const sourceKey = typeof body?.sourceKey === "string" ? body.sourceKey.trim() : "";
    if (!sourceKey) {
      return apiError(400, "sourceKey 不能为空", { code: API_ERROR_CODES.validation_failed, requestId });
    }

    const items = Array.isArray(body?.items) ? (body.items as ContentImportItemInput[]) : [];
    const scope = Array.isArray(body?.scope)
      ? body.scope.filter((s): s is string => typeof s === "string")
      : [];
    mode = body?.mode === "apply" ? "apply" : "dry-run";
    const commitSha = typeof body?.commitSha === "string" ? body.commitSha.trim() : null;
    const createdBy = typeof body?.createdBy === "string" ? body.createdBy.trim() : "cli";

    const result = await timed("lwb_content_import_duration_ms", { mode }, () =>
      runContentImport({ sourceKey, mode, commitSha, scope, items, createdBy })
    );
    inc("lwb_content_import_total", { mode, status: result.status });
    logger.info("[internal/content/import] done:", JSON.stringify({ sourceKey, mode, batchId: result.batchId }));
    await writeAuditLog({
      action: "content.import",
      actorId: guard.actorId,
      actorType: guard.actorType,
      targetType: "content_source",
      targetId: sourceKey,
      meta: { mode, batchId: result.batchId, counts: result.counts, commitSha },
      requestId,
      ip: guard.ip,
    });
    return NextResponse.json({ ok: true, requestId, ...result });
  } catch (error) {
    inc("lwb_content_import_total", { mode, status: "error" });
    if (error instanceof ContentImportError) {
      return apiError(error.status, error.message, { code: importErrorCode(error.status), requestId });
    }
    logger.error("content import error", error, requestId);
    return apiError(500, "内容导入失败", { code: API_ERROR_CODES.internal_error, requestId });
  }
}
