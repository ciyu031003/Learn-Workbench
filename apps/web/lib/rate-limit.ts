import { getRedis } from "./redis";
import { logger } from "./logger";

/**
 * 固定窗口限流：
 * - 单实例（默认）：进程内 Map，随进程重启清零；
 * - 多实例（REDIS_URL 配置时）：Redis Lua 原子计数，全实例共享窗口；
 * - Redis 故障自动降级进程内（限流旁路，不阻塞主链路）。
 * 用于登录、受限操作等接口的第一道防线；登录防爆破的持久计数走 auth_attempts 表。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** INCR + 首次 PEXPIRE 原子化（脚本原子执行，进程崩溃不会留下无 TTL 的永久键） */
const RATE_LIMIT_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return n
`;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

function memoryRateLimit(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();
  // 防内存膨胀：桶过多时清理过期项
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (b.count >= opts.limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return memoryRateLimit(key, opts);
  const redisKey = `lwb:rl:${key}`;
  try {
    const n = (await redis.eval(RATE_LIMIT_LUA, 1, redisKey, String(opts.windowMs))) as number;
    if (n <= opts.limit) return { ok: true, retryAfterSeconds: 0 };
    const ttl = await redis.pttl(redisKey);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((ttl > 0 ? ttl : opts.windowMs) / 1000)) };
  } catch (e) {
    logger.warn("[rate-limit] redis unavailable, falling back to in-process:", e);
    return memoryRateLimit(key, opts);
  }
}

/** 清空进程内桶（仅测试用；Redis 模式下测试应 mock @/lib/redis） */
export function resetRateLimits(): void {
  buckets.clear();
}
