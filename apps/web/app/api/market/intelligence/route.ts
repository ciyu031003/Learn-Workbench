import { NextResponse } from "next/server";
import {
  queryMarketIntelligence,
  type MarketIntelligenceFilters,
  type MarketIntelligenceRange,
} from "@/lib/domains/market/intelligence";
import { logger } from "@/lib/logger";

function parseRange(value: string | null): MarketIntelligenceRange | undefined {
  if (value === "7" || value === "30" || value === "90") return Number(value) as MarketIntelligenceRange;
  return undefined;
}

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const filters: MarketIntelligenceFilters = {
      q: params.get("q")?.trim() || undefined,
      city: params.get("city")?.trim() || undefined,
      functionKey: params.get("function")?.trim() || undefined,
      industrySector: params.get("industrySector")?.trim() || undefined,
      industrySubsector: params.get("industrySubsector")?.trim() || undefined,
      seniorityBucket: params.get("seniority")?.trim() || undefined,
      source: params.get("source")?.trim() || undefined,
      salaryMin: parseNumber(params.get("salaryMin")),
      salaryMax: parseNumber(params.get("salaryMax")),
      range: parseRange(params.get("range")),
    };
    const payload = await queryMarketIntelligence(filters);
    return NextResponse.json(payload);
  } catch (error) {
    logger.error("market intelligence api error", error);
    return NextResponse.json({ error: "市场情报加载失败" }, { status: 500 });
  }
}
