import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { getMarketDecision } from "@/lib/domains/market/decision";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const city = params.get("city")?.trim() || undefined;
  const functionKey = params.get("function")?.trim() || undefined;
  try {
    const userId = await currentUserId();
    const payload = await getMarketDecision(userId, { city, functionKey });
    return NextResponse.json(payload);
  } catch (error) {
    logger.error("market decision api error", error);
    return NextResponse.json({ error: "市场决策加载失败" }, { status: 500 });
  }
}
