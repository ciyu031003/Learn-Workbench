import { NextResponse } from "next/server";
import { analyzeMarket } from "@/lib/market";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const data = await analyzeMarket();
    return NextResponse.json(data);
  } catch (e) {
    logger.error("market api error", e);
    return NextResponse.json({ error: "市场分析加载失败" }, { status: 500 });
  }
}
