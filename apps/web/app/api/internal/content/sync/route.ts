import { NextResponse } from "next/server";
import {
  buildContentSyncPlan,
  readContentPackageVersion,
  syncKnowledgeModel,
} from "@/lib/content/knowledge-model";
import { logger } from "@/lib/logger";

/**
 * POST /api/internal/content/sync —— 把内容包（packages/content）同步进统一内容模型（组二 · 阶段 7 = Phase A）。
 *
 * 鉴权：x-cron-secret == CRON_SECRET（与 cron / 导入接口同款）。
 * 幂等：知识点按稳定 key upsert（指纹相同即跳过）；关联行只重写 derived，人工审定的 curated 边保留；
 *      模型里消失的知识点只软归档（status='archived'），历史作答仍可追溯。
 * body（都可选）：
 *   { dryRun?: boolean, contentVersion?: string, contentUpdatedAt?: string, reviewTtlDays?: number }
 *   —— dryRun 只回报 inserted/updated/unchanged 预览，不写库（迁移/上线前先看差异）。
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    dryRun?: unknown;
    contentVersion?: unknown;
    contentUpdatedAt?: unknown;
    reviewTtlDays?: unknown;
  } | null;

  // 默认取 git 上内容包真实版本，避免"手填版本号"带来假数据
  const git = readContentPackageVersion();
  const contentVersion = typeof body?.contentVersion === "string" && body.contentVersion.trim()
    ? body.contentVersion.trim().slice(0, 40)
    : git.version;
  const contentUpdatedAt =
    typeof body?.contentUpdatedAt === "string" && body.contentUpdatedAt.trim()
      ? new Date(body.contentUpdatedAt).toISOString()
      : git.updatedAt;
  const reviewTtlDays = Number.isFinite(Number(body?.reviewTtlDays)) ? Number(body!.reviewTtlDays) : undefined;
  const dryRun = body?.dryRun === true;

  try {
    const plan = buildContentSyncPlan({ contentVersion, contentUpdatedAt, reviewTtlDays });
    const result = await syncKnowledgeModel(plan, { dryRun });
    logger.info("[internal/content/sync] done:", JSON.stringify({ dryRun, contentVersion, result }));
    // result 自带 contentVersion，这里只补 dryRun / contentUpdatedAt
    return NextResponse.json({ ok: true, dryRun, contentUpdatedAt, ...result });
  } catch (error) {
    logger.error("content sync error", error);
    return NextResponse.json({ error: "内容模型同步失败" }, { status: 500 });
  }
}
