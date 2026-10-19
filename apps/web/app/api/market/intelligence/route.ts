import { NextResponse } from "next/server";
import {
  queryMarketIntelligence,
  type MarketIntelligenceFilters,
  type MarketIntelligenceRange,
} from "@/lib/domains/market/intelligence";
import { logger } from "@/lib/logger";
import { userScope } from "@/lib/anon";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  CACHE_PRIVATE_NO_STORE,
  CACHE_PUBLIC_AGGREGATE_60,
  withPrivateNoStore,
} from "@/lib/api/cache";

/**
 * S5-5：公开只读聚合的 60s 进程内缓存。
 *
 * 为什么缓存：市场情报是重聚合（多次扫 job_postings/聚合表），前端筛选器切换会重复打库。
 * 同参数 60s 内直接命中内存；多实例部署时各实例各自缓存（不引入 Redis，命中率下降但结果一致）。
 * 缓存 key 只含筛选条件（该接口是公开聚合，不含用户态数据）。
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 100;
const payloadCache = new Map<string, { at: number; payload: unknown }>();

function readCached(key: string): unknown | undefined {
  const hit = payloadCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    payloadCache.delete(key);
    return undefined;
  }
  return hit.payload;
}

function writeCached(key: string, payload: unknown): void {
  if (payloadCache.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of payloadCache) if (now - v.at > CACHE_TTL_MS) payloadCache.delete(k);
    // 仍满：删最早写入的一条（Map 保留插入序）
    while (payloadCache.size >= CACHE_MAX_ENTRIES) {
      const oldest = payloadCache.keys().next();
      if (oldest.done) break;
      payloadCache.delete(oldest.value);
    }
  }
  payloadCache.set(key, { at: Date.now(), payload });
}

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
    // S5-5：匿名限流（key 优先 uid，其次设备 anonId，最后 IP）
    const scope = await userScope();
    const who = scope.uid ?? scope.anonId ?? clientIp(req);
    const throttle = await rateLimit(`market-intelligence:${who}`, { limit: 60, windowMs: 60_000 });
    if (!throttle.ok) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Cache-Control": CACHE_PRIVATE_NO_STORE,
            "Retry-After": String(throttle.retryAfterSeconds),
          },
        }
      );
    }

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

    const cacheKey = JSON.stringify(filters);
    const cached = readCached(cacheKey);
    if (cached !== undefined) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": CACHE_PUBLIC_AGGREGATE_60, "X-Cache": "HIT" },
      });
    }

    const payload = await queryMarketIntelligence(filters);
    writeCached(cacheKey, payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_PUBLIC_AGGREGATE_60, "X-Cache": "MISS" },
    });
  } catch (error) {
    logger.error("market intelligence api error", error);
    // 错误不缓存
    return withPrivateNoStore(NextResponse.json({ error: "市场情报加载失败" }, { status: 500 }));
  }
}
