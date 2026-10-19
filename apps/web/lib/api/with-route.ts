import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { API_ERROR_CODES, apiError, dbErrorResponse } from "@/lib/api-error";
import { currentUserId } from "@/lib/session";
import { userScope } from "@/lib/anon";
import { clientIp } from "@/lib/auth";
import { guardInternalRequest } from "@/lib/internal-guard";
import { rateLimit } from "@/lib/rate-limit";
import { assertAnonWriteAllowed } from "@/lib/anon-quota";
import { logRequest } from "@/lib/api/log-request";
import { inc, observe } from "@/lib/metrics";
import { REQUEST_ID_HEADER, requestIdFrom } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import type { Role } from "@/lib/roles";

/**
 * 统一 API 入口（S2-1 · withApi）。
 *
 * 目的：把「鉴权 → 限流 → 请求体上限 → zod 校验 → 统一错误 envelope → requestId」收敛成一条链，
 * 新接口只写业务；存量按高危写接口优先迁移（棘轮：未迁移数只降不升）。
 *
 * 设计要点：
 *  - 请求体**流式读取并计数**，超限立即取消流并返回 413（不再"先全量缓冲再判长度"）；
 *  - 错误响应统一 { error, code, requestId }，并回写 x-request-id 头，便于日志对账；
 *  - 用户态默认 Cache-Control: private, no-store；公共只读可显式声明 s-maxage；
 *  - handler 抛错不裸奔：记录 requestId 后走 dbErrorResponse（PG 约束 → 400，其余 → 500）。
 */
export type RouteAuth = "user" | "anon" | "public" | "internal";

export interface RouteContext<TBody> {
  req: Request;
  requestId: string;
  uid: string | null;
  anonId: string | null;
  ip: string;
  /** 未按 schema 裁剪的原始 JSON（用于需要确认字段等场景） */
  rawBody: unknown;
  /** 按 schema 解析后的 body（未传 schema 时即 rawBody） */
  body: TBody;
}

export interface WithRouteOptions<TBody> {
  auth: RouteAuth;
  schema?: ZodType<TBody>;
  /** 限流：默认 key = auth:uid|anonId|ip */
  limit?: { key?: string; n: number; windowMs: number };
  /** 请求体上限（字节），默认 1MB；流式读取，超限 413 */
  bodyLimit?: number;
  /**
   * 匿名写配额（S2-8）：传目标表名（必须是代码常量，禁止来自请求参数）。
   * 匿名设备在该表超过 500 行时返回 429 quota_exceeded；登录用户不受限。
   */
  anonWriteTable?: string;
  /** 缓存策略：用户态默认 no-store；公共接口可声明 s-maxage + swr */
  cache?: "no-store" | { sMaxAge: number; swr?: number };
  /** internal 模式必填：内部接口名（用于限流桶与审计） */
  internalName?: string;
  internalLimit?: number;
  internalWindowMs?: number;
  internalRoles?: readonly Role[];
}

interface BodyReadResult {
  ok: boolean;
  status?: number;
  error?: string;
  data?: unknown;
}

const DECODER = new TextDecoder();

/** 流式读取 JSON 且限制大小：超过 maxBytes 立刻取消读取，避免内存放大 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<BodyReadResult> {
  const stream = req.body;
  if (!stream) return { ok: true, data: null };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // 忽略取消失败
        }
        return { ok: false, status: 413, error: "请求体过大" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "无法读取请求体" };
  }

  if (total === 0) return { ok: true, data: null };
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  const text = DECODER.decode(merged);
  if (!text.trim()) return { ok: true, data: null };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "JSON 解析失败" };
  }
}

function applyHeaders(res: Response, requestId: string, cache: WithRouteOptions<unknown>["cache"]): Response {
  try {
    res.headers.set(REQUEST_ID_HEADER, requestId);
    if (cache === "no-store" || cache === undefined) {
      res.headers.set("Cache-Control", "private, no-store");
    } else {
      const parts = ["public", `s-maxage=${cache.sMaxAge}`];
      if (cache.swr) parts.push(`stale-while-revalidate=${cache.swr}`);
      res.headers.set("Cache-Control", parts.join(", "));
    }
  } catch {
    // 某些 Response（不可变头）不允许改写：requestId 仍会出现在 body/日志
  }
  return res;
}

export function withRoute<TBody = unknown>(
  opts: WithRouteOptions<TBody>,
  handler: (ctx: RouteContext<TBody>) => Promise<Response> | Response
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const requestId = requestIdFrom(req);
    const started = Date.now();
    const ip = clientIp(req);
    const finish = (res: Response): Response => {
      applyHeaders(res, requestId, opts.cache);
      const ms = Date.now() - started;
      // 请求级访问日志：只记 pathname（不含 query，避免 token/票据落日志）
      logRequest(req, res.status, ms, requestId);
      // 指标（S4-5）：基数纪律——标签只允许 method / status，绝不带 path/user
      inc("lwb_http_requests_total", { method: req.method, status: String(res.status) }, 1);
      observe("lwb_http_request_duration_ms", ms, { method: req.method });
      return res;
    };

    let uid: string | null = null;
    let anonId: string | null = null;

    try {
      // 1) 鉴权
      if (opts.auth === "internal") {
        const guard = await guardInternalRequest(req, opts.internalName ?? "route", {
          limit: opts.internalLimit,
          windowMs: opts.internalWindowMs,
          allowRoles: opts.internalRoles,
        });
        if (!guard.ok) return finish(guard.response);
        uid = guard.actorId;
      } else if (opts.auth === "user") {
        uid = await currentUserId();
        if (!uid) {
          return finish(apiError(401, "请先登录", { code: API_ERROR_CODES.unauthorized, requestId }));
        }
      } else if (opts.auth === "anon") {
        const scope = await userScope();
        uid = scope.uid;
        anonId = scope.anonId;
        const isWrite = req.method !== "GET" && req.method !== "HEAD";
        // S1-7 fail-closed：匿名写必须有合法设备标识（否则会落进"无人可读"的行）
        if (isWrite && !uid && !anonId) {
          return finish(
            apiError(400, "缺少设备标识，请刷新页面后重试", {
              code: API_ERROR_CODES.validation_failed,
              requestId,
            })
          );
        }
      }

      // 2) 限流
      if (opts.limit) {
        const who = uid ?? anonId ?? ip;
        const key = `${opts.limit.key ?? opts.auth}:${who}`;
        const rl = await rateLimit(key, { limit: opts.limit.n, windowMs: opts.limit.windowMs });
        if (!rl.ok) {
          return finish(
            apiError(429, "操作过于频繁，请稍后再试", {
              code: API_ERROR_CODES.rate_limited,
              requestId,
              retryAfterSeconds: rl.retryAfterSeconds,
            })
          );
        }
      }

      // 3) 请求体 + 4) schema
      let rawBody: unknown = null;
      let body = undefined as unknown as TBody;
      if (opts.schema || opts.bodyLimit || req.method !== "GET") {
        const read = await readJsonBody(req, opts.bodyLimit ?? 1_000_000);
        if (!read.ok) {
          return finish(
            apiError(read.status ?? 400, read.error ?? "请求体不合法", {
              code: API_ERROR_CODES.validation_failed,
              requestId,
            })
          );
        }
        rawBody = read.data;
        if (opts.schema) {
          const parsed = opts.schema.safeParse(read.data ?? {});
          if (!parsed.success) {
            return finish(
              apiError(400, "请求参数不合法", {
                code: API_ERROR_CODES.validation_failed,
                requestId,
              })
            );
          }
          body = parsed.data;
        } else {
          body = read.data as TBody;
        }
      }

      // 5) 匿名写配额（S2-8）：只对匿名设备生效，表名由调用方以常量传入
      if (opts.anonWriteTable && req.method !== "GET" && req.method !== "HEAD" && !uid) {
        const quota = await assertAnonWriteAllowed({ uid, anonId }, opts.anonWriteTable);
        if (!quota.ok) {
          return finish(
            apiError(429, `该设备的此类记录已达上限（${quota.limit} 条），请登录后继续`, {
              code: API_ERROR_CODES.quota_exceeded,
              requestId,
              retryAfterSeconds: 0,
            })
          );
        }
      }

      // 6) 业务
      const res = await handler({ req, requestId, uid, anonId, ip, rawBody, body });
      return finish(res);
    } catch (e) {
      logger.error("[api] handler failed", e, { requestId, path: new URL(req.url).pathname });
      return finish(dbErrorResponse(e, "服务异常，请稍后重试", { requestId }));
    }
  };
}

/** 便捷：直接返回 JSON（与 withRoute 配合） */
export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
