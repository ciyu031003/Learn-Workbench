import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { createMarketSavedView, listMarketSavedViews } from "@/lib/domains/market/saved-views";
import type { MarketIntelligenceFilters } from "@/lib/domains/market/intelligence";
import { logger } from "@/lib/logger";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const views = await listMarketSavedViews(userId);
    return NextResponse.json({ views });
  } catch (error) {
    logger.error("market views list error", error);
    return NextResponse.json({ error: "市场视图加载失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const filters =
    body?.filters && typeof body.filters === "object"
      ? (body.filters as MarketIntelligenceFilters)
      : {};
  if (!name) return NextResponse.json({ error: "视图名称不能为空" }, { status: 400 });
  try {
    const view = await createMarketSavedView(userId, name, filters);
    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    logger.error("market view create error", error);
    return NextResponse.json({ error: "市场视图保存失败" }, { status: 500 });
  }
}
