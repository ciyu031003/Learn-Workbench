import Redis from "ioredis";
import { logger } from "./logger";

/**
 * Redis 单例（P2 多实例预案）：
 * - REDIS_URL 未配置 → 返回 null，限流/缓存走进程内实现（单实例部署的默认形态）；
 * - 连接参数按"限流旁路"调优：短超时 + 关闭离线队列 + 快速失败，
 *   Redis 故障时调用方自动降级进程内实现，不影响请求主链路；
 * - 客户端缓存到 globalThis（与 pg 池同模式，dev 热重载不重复建连）。
 */
const globalForRedis = globalThis as unknown as { lwbRedisClient?: Redis | null };

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (globalForRedis.lwbRedisClient !== undefined) return globalForRedis.lwbRedisClient;
  let client: Redis | null = null;
  try {
    client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: 500,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 5000)),
    });
    client.on("error", (e) => {
      logger.warn("[redis] connection error (callers degrade to in-process):", e.message);
    });
  } catch (e) {
    logger.warn("[redis] init failed, running in-process only:", e);
    client = null;
  }
  globalForRedis.lwbRedisClient = client;
  return client;
}
