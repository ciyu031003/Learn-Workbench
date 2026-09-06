import { getRedis } from "./redis";
import { logger } from "./logger";

/**
 * TTL 缓存（轻量，防重复计算/防刷上游配额）：
 * - 单实例（默认）：进程内 Map；
 * - 多实例（REDIS_URL 配置时）：Redis 共享，跨实例命中；
 * - Redis 故障自动降级进程内实现。
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 10_000;

export async function dailyCacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(`lwb:cache:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (e) {
      logger.warn("[daily-cache] redis get failed, falling back to in-process:", e);
    }
  }
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return e.value as T;
}

export async function dailyCacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`lwb:cache:${key}`, JSON.stringify(value), "PX", ttlMs);
      return;
    } catch (e) {
      logger.warn("[daily-cache] redis set failed, falling back to in-process:", e);
    }
  }
  // 防内存膨胀：条目过多时清理过期项
  if (store.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expiresAt <= now) store.delete(k);
    }
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** 清空进程内缓存（仅测试用；Redis 模式下测试应 mock @/lib/redis） */
export function resetDailyCache(): void {
  store.clear();
}
