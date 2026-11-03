import { NextResponse } from "next/server";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { computeRadar, radarFallback } from "@/lib/radar";
import { logger } from "@/lib/logger";

/**
 * GET /api/jobs/radar —— 就业雷达（B 为主 + A 兜底）
 * 已登录且有画像：批量匹配（画像 × 岗位集）。
 * 未登录 / 无画像：回落 A（仅按城市给活跃岗位列表，不含匹配分）。
 *
 * 查询参数：
 * - city：覆盖画像城市；
 * - limit：候选上限（≤200）；
 * - target：按目标岗位重算（去空白；>40 字符 400）；缺省/空串回落 user_settings.target_role。
 */
export async function GET(req: Request) {
  try {
    // 匿名接口先取 token，避免空 token 进入 hashToken（踩坑点 34）
    const token = await currentSessionToken();
    const url = new URL(req.url);
    const city = url.searchParams.get("city")?.trim() || null;
    const limitRaw = Number(url.searchParams.get("limit"));
    // 上限 200：移动端一次取全候选集，在前端做「筛选 + 排序 + 加载更多」
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.round(limitRaw)) : undefined;
    // 目标岗位：去空白后空串按未传处理（与 computeRadar 的回落口径一致）；超长直接 400
    const target = url.searchParams.get("target")?.trim() || null;
    if (target && target.length > 40) {
      return NextResponse.json({ error: "目标岗位不能超过 40 个字符" }, { status: 400 });
    }

    if (!token) {
      const result = await radarFallback({ city, limit, target });
      return NextResponse.json({ ...result, mode: "fallback" });
    }

    const userId = await currentUserId();
    if (!userId) {
      const result = await radarFallback({ city, limit, target });
      return NextResponse.json({ ...result, mode: "fallback" });
    }

    const result = await computeRadar(userId, { city, limit, target });
    return NextResponse.json({
      ...result,
      mode: result.hasProfile ? "batch" : "fallback",
    });
  } catch (e) {
    logger.error("radar api error", e);
    return NextResponse.json({ error: "数据暂时不可用" }, { status: 500 });
  }
}