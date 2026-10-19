/**
 * 统一客户端请求层（S6-1）。
 *
 * 目标：把散落各页的裸 fetch 收敛成一处，统一处理：
 * - 超时（默认 8s，AbortController；调用方还可传自己的 signal 做切页取消）
 * - 非 2xx -> ApiError(status, code, message)，页面只关心业务分支
 * - 401 -> 跳登录（带 from 回跳），避免每页各写一遍
 * - JSON 解析失败兜底：返回 null 而不是抛 SyntaxError（页面按空数据渲染，不白屏）
 * - 网络错误 / 超时归一成 ApiError(0, "NETWORK" | "TIMEOUT")
 *
 * 用法示例：
 *   const phases = await apiGet<RoadmapResponse>("/api/roadmap?career=" + career, { signal });
 *   await apiMutate("/api/progress", "POST", { topicId, done });
 */

/** 默认请求超时（与移动端/接口 P95 对齐：8s 足够，避免用户无限等待） */
export const CLIENT_API_TIMEOUT_MS = 8000;

export type ApiMethod = "POST" | "PUT" | "PATCH" | "DELETE";

/** 统一错误：status=0 表示请求没到服务端（网络错误 / 超时 / 主动取消） */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiRequestOptions {
  /** 单请求超时（ms），默认 CLIENT_API_TIMEOUT_MS */
  timeoutMs?: number;
  /** 调用方 AbortSignal（如切页/组件卸载时取消） */
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** 401 时是否跳登录，默认 true；登录页自身/探测型请求可关掉 */
  redirectOn401?: boolean;
  /** GET 空响应/JSON 解析失败时的兜底返回值，默认 null */
  fallback?: unknown;
}

/** 取消类错误（AbortController.abort）——调用方通常直接忽略 */
export function isAbortError(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { name?: string }).name === "AbortError";
}

function buildLoginUrl(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const pathname = window.location.pathname || "/";
  if (pathname === "/login" || pathname.startsWith("/login/")) return null;
  const from = pathname + (window.location.search || "");
  return "/login?from=" + encodeURIComponent(from);
}

/** 401 统一处理：跳登录（当前已在登录页则不再跳，避免循环） */
function handleUnauthorized(): void {
  const url = buildLoginUrl();
  if (!url) return;
  try {
    window.location.assign(url);
  } catch {
    // 非浏览器环境/被禁用时静默（调用方仍会拿到 ApiError(401)）
  }
}

/** 把外部 signal 与超时合并成一个 controller，返回 { signal, cleanup } */
function withTimeout(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timeoutHit = false;
  const timer = setTimeout(() => {
    timeoutHit = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (external) external.removeEventListener("abort", onExternalAbort);
    },
    timedOut: () => timeoutHit,
  };
}

/** 读取响应体：空响应返回 fallback；JSON 解析失败也返回 fallback（不抛 SyntaxError） */
async function readJson(res: Response, fallback: unknown): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** 从错误响应体里提取可读 message/code（兼容 {error}, {message}, {error:{code,message}}） */
function errorFromBody(body: unknown, status: number): ApiError {
  let message = "请求失败（HTTP " + status + "）";
  let code = "HTTP_" + status;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const inner = b.error && typeof b.error === "object" ? (b.error as Record<string, unknown>) : null;
    const rawMessage = b.error ?? b.message ?? (inner ? inner.message : undefined);
    if (typeof rawMessage === "string" && rawMessage.trim()) message = rawMessage;
    const rawCode = b.code ?? (inner ? inner.code : undefined);
    if (typeof rawCode === "string" && rawCode.trim()) code = rawCode;
  }
  return new ApiError(message, status, code);
}

async function request(method: string, path: string, body: unknown, options: ApiRequestOptions): Promise<unknown> {
  const { timeoutMs = CLIENT_API_TIMEOUT_MS, signal, headers, redirectOn401 = true, fallback = null } = options;
  const { signal: merged, cleanup, timedOut } = withTimeout(timeoutMs, signal);
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? headers : { "content-type": "application/json", ...(headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: merged,
      credentials: "same-origin",
    });
  } catch (e) {
    cleanup();
    if (isAbortError(e)) {
      if (timedOut()) throw new ApiError("请求超时，请稍后重试", 0, "TIMEOUT");
      // 调用方主动取消：原样抛出 AbortError，让调用方按取消处理
      throw e;
    }
    throw new ApiError("网络异常，请检查网络后重试", 0, "NETWORK");
  }
  cleanup();

  if (res.status === 401 && redirectOn401) {
    handleUnauthorized();
  }

  if (!res.ok) {
    const errBody = await readJson(res, null);
    throw errorFromBody(errBody, res.status);
  }

  if (res.status === 204) return fallback;
  return readJson(res, fallback);
}

/** GET 请求：返回解析后的 JSON；解析失败/空响应返回 fallback（默认 null） */
export async function apiGet<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return (await request("GET", path, undefined, options)) as T;
}

/** 写请求（POST/PUT/PATCH/DELETE），默认 POST；body 可省略 */
export async function apiMutate<T>(
  path: string,
  method: ApiMethod = "POST",
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  return (await request(method, path, body, options)) as T;
}
