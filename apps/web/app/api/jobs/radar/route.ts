import { NextResponse } from "next/server";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { computeRadar, radarFallback } from "@/lib/radar";
import { logger } from "@/lib/logger";

/**
 * GET /api/jobs/radar —— 就业雷达（B 为主 + A 兜底）
 * 已登录且有画像：批量匹配（画像 × 岗位集）。
 * 未登录 / 无画像：回落 A（仅按城市给活跃岗位列表，不含匹配分）。
 */
export async function GET(req: Request) {
  try {
    // 匿名接口先取 token，避免空 token 进入 hashToken（踩坑点 34）
    const token = await currentSessionToken();
    const url = new URL(req.url);
    const city = url.searchParams.get("city")?.trim() || null;
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(24, Math.round(limitRaw)) : undefined;

    if (!token) {
      const result = await radarFallback({ city, limit });
      return NextResponse.json({ ...result, mode: "fallback" });
    }

    const userId = await currentUserId();
    if (!userId) {
      const result = await radarFallback({ city, limit });
      return NextResponse.json({ ...result, mode: "fallback" });
    }

    const result = await computeRadar(userId, { city, limit });
    return NextResponse.json({
      ...result,
      mode: result.hasProfile ? "batch" : "fallback",
    });
  } catch (e) {
    logger.error("radar api error", e);
    return NextResponse.json({ error: "数据暂时不可用" }, { status: 500 });
  }
}