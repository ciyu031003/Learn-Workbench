import { NextResponse } from "next/server";
import {
  ContentImportError,
  rollbackContentImport,
  runContentImport,
  type ContentImportItemInput,
} from "@/lib/content/import-pipeline";
import { logger } from "@/lib/logger";

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
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    sourceKey?: unknown;
    mode?: unknown;
    commitSha?: unknown;
    scope?: unknown;
    items?: unknown;
    createdBy?: unknown;
    rollback?: unknown;
  } | null;

  try {
    const rollbackId = Number(body?.rollback);
    if (Number.isInteger(rollbackId) && rollbackId > 0) {
      const result = await rollbackContentImport(rollbackId);
      logger.info("[internal/content/import] rolled back:", JSON.stringify(result));
      return NextResponse.json({ ok: true, rollback: true, ...result });
    }

    const sourceKey = typeof body?.sourceKey === "string" ? body.sourceKey.trim() : "";
    if (!sourceKey) return NextResponse.json({ error: "sourceKey 不能为空" }, { status: 400 });

    const items = Array.isArray(body?.items) ? (body.items as ContentImportItemInput[]) : [];
    const scope = Array.isArray(body?.scope)
      ? body.scope.filter((s): s is string => typeof s === "string")
      : [];
    const mode = body?.mode === "apply" ? "apply" : "dry-run";
    const commitSha = typeof body?.commitSha === "string" ? body.commitSha.trim() : null;
    const createdBy = typeof body?.createdBy === "string" ? body.createdBy.trim() : "cli";

    const result = await runContentImport({ sourceKey, mode, commitSha, scope, items, createdBy });
    logger.info("[internal/content/import] done:", JSON.stringify({ sourceKey, mode, batchId: result.batchId }));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ContentImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("content import error", error);
    return NextResponse.json({ error: "内容导入失败" }, { status: 500 });
  }
}
