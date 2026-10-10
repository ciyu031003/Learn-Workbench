import { NextResponse } from "next/server";
import { stalePointKeys } from "@/lib/content/point-states";
import { logger } from "@/lib/logger";
import { DEFAULT_REVIEW_TTL_DAYS } from "@/lib/content/knowledge-model";

/**
 * GET /api/learning/content-freshness[?track=<slug>] —— 内容时效（组二 · 阶段 14 = Phase G）。
 *
 * 公开只读：返回 `stale_after` 已过期的知识点 key，页面据此提示「内容可能过时，建议复核」。
 * 库不可用（迁移未跑）时返回空列表：新鲜度提示是**辅助信息**，不该把课程页拖垮。
 */
export async function GET(req: Request) {
  const trackSlug = new URL(req.url).searchParams.get("track") ?? undefined;
  try {
    const stale = await stalePointKeys(trackSlug || undefined);
    return NextResponse.json({ available: true, reviewTtlDays: DEFAULT_REVIEW_TTL_DAYS, stale });
  } catch (error) {
    logger.warn("content freshness unavailable", error);
    return NextResponse.json({ available: false, reviewTtlDays: DEFAULT_REVIEW_TTL_DAYS, stale: [] });
  }
}
