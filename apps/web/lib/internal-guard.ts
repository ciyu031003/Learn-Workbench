import { apiError, API_ERROR_CODES } from "./api-error";
import { requestIdFrom } from "./request-id";
import { rateLimit } from "./rate-limit";
import { clientIp } from "./auth";
import { currentUserId } from "./session";
import { roleOf, type Role } from "./roles";
import type { AuditActorType } from "./audit";

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
  /** 谁触发的：密钥触发为 null（actorType='cron'/'cli'），会话触发为用户 id。 */
  actorId: string | null;
  actorType: AuditActorType;
  ip: string;
}

export interface InternalGuardBlocked {
  ok: false;
  requestId: string;
  response: Response;
}

export type InternalGuardResult = InternalGuardOk | InternalGuardBlocked;

/**
 * 会话兜底：允许指定角色的人（如内容编辑）在浏览器里直接调内部接口。
 * `next/headers` 在非请求上下文（单测 / 脚本）会抛，这里吞掉 —— 内部接口不能因为拿不到 cookie 就 500。
 */
async function sessionActor(): Promise<{ id: string; role: Role } | null> {
  try {
    const userId = await currentUserId();
    if (!userId) return null;
    return { id: userId, role: await roleOf(userId) };
  } catch {
    return null;
  }
}

export async function guardInternalRequest(
  req: Request,
  name: string,
  opts: { limit?: number; windowMs?: number; allowRoles?: readonly Role[] } = {}
): Promise<InternalGuardResult> {
  const requestId = requestIdFrom(req);
  const ip = clientIp(req);

  const throttle = await rateLimit(`internal:${name}:${ip}`, {
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
  if (expected && got === expected) {
    return { ok: true, requestId, actorId: null, actorType: "cron", ip };
  }

  if (opts.allowRoles?.length) {
    const actor = await sessionActor();
    if (actor && opts.allowRoles.includes(actor.role)) {
      return { ok: true, requestId, actorId: actor.id, actorType: "user", ip };
    }
  }

  return {
    ok: false,
    requestId,
    response: apiError(403, "未授权", { code: API_ERROR_CODES.forbidden, requestId }),
  };
}
