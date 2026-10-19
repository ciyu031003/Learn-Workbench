/**
 * S5-5 缓存头策略（按 auth 等级统一下发）。
 *
 * 约定（与 lib/api/with-route.ts 的 applyHeaders 保持同一口径）：
 *  - 已登录 / 带 cookie 的业务接口：private, no-store（任何层都不得缓存）；
 *  - 公开只读聚合：public, s-maxage=60, stale-while-revalidate=120；
 *  - 错误/限流响应：private, no-store（错误不缓存）。
 *
 * 这些端点没有走 withApi（multipart / 二进制 / 早期存量），所以用手写头；
 * 新接口优先用 withRoute({ cache })，不要重复造轮子。
 */
export const CACHE_PRIVATE_NO_STORE = "private, no-store";

/** 公开只读聚合缓存：CDN 60s + 后台 SWR 120s */
export function publicAggregateCacheControl(sMaxAge = 60, swr = 120): string {
  const parts = ["public", `s-maxage=${sMaxAge}`];
  if (swr > 0) parts.push(`stale-while-revalidate=${swr}`);
  return parts.join(", ");
}

export const CACHE_PUBLIC_AGGREGATE_60 = publicAggregateCacheControl();

/** 就地写 Cache-Control；Response 头不可变时静默跳过（不因缓存头失败影响业务） */
export function applyCacheControl<T extends Response>(res: T, value: string): T {
  try {
    res.headers.set("Cache-Control", value);
  } catch {
    // 某些 Response（不可变头）不允许改写：保持业务可用
  }
  return res;
}

/** 用户态响应包的快捷包装：private, no-store */
export function withPrivateNoStore<T extends Response>(res: T): T {
  return applyCacheControl(res, CACHE_PRIVATE_NO_STORE);
}
