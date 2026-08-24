import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { aggregateMarketGaps } from "@/lib/skills";
import { logger } from "@/lib/logger";

// 学习 × 招聘打通：市场高频需求 × 我的能力缺口（聚合视图）
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit")) || 12;
  try {
    const { gaps, totalJobs } = await aggregateMarketGaps(userId, { limit });
    return NextResponse.json({ gaps, totalJobs, generatedAt: new Date().toISOString() });
  } catch (e) {
    logger.error("skills gaps error", e);
    return NextResponse.json({ error: "市场需求缺口分析失败" }, { status: 500 });
  }
}
