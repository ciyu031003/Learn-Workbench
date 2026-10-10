import { apiError, API_ERROR_CODES } from "./api-error";
import { requestIdFrom } from "./request-id";
import { rateLimit } from "./rate-limit";
import { clientIp } from "./auth";

/**
 * `api/internal/**` 的统一前门（组三 · H2 API 治理）。
 *
 * 顺序有意为之：**先限流，再验密钥**。
 *   - 反了的话，密钥错误也会先做一次字符串比较，攻击者可以用错误密钥无限探测（无限流）；
 *   - 限流放最前，连"错密钥探测"也会被计入桶，探测成本立刻上来。
 *
 * 返回 `{ ok: true, requestId }` 或 `{ ok: false, response }`（调用方直接 return）。
 */

export interface InternalGuardOk {
  ok: true;
  requestId: string;
}

export interface InternalGuardBlocked {
  ok: false;
  requestId: string;
  response: Response;
}

export type InternalGuardResult = InternalGuardOk | InternalGuardBlocked;

export async function guardInternalRequest(
  req: Request,
  name: string,
  opts: { limit?: number; windowMs?: number } = {}
): Promise<InternalGuardResult> {
  const requestId = requestIdFrom(req);

  const throttle = await rateLimit(`internal:${name}:${clientIp(req)}`, {
    limit: opts.limit ?? 30,
    windowMs: opts.windowMs ?? 60_000,
  });
  if (!throttle.ok) {
    return {
      ok: false,
      requestId,
      response: apiError(429, "操作过于频繁，请稍后再试", {
        code: API_ERROR_CODES.rate_limited,
        requestId,
        retryAfterSeconds: throttle.retryAfterSeconds,
      }),
    };
  }

  const expected = process.env.CRON_SECRET?.trim();
  const got = req.headers.get("x-cron-secret")?.trim();
  if (!expected || got !== expected) {
    return {
      ok: false,
      requestId,
      response: apiError(403, "未授权", { code: API_ERROR_CODES.forbidden, requestId }),
    };
  }

  return { ok: true, requestId };
}
