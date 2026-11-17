import { getApiUrl } from "@/config";

/**
 * 统一请求出口（P5 · 架构项 7.2）：把"拼 URL + 带 Bearer + 判 ok + 解析 JSON"收口成一处。
 *
 * 设计原则（刻意保守，避免顺手改行为）：
 *  - **不抛异常**：网络错误/超时返回 { ok:false, status:0, error:"network" }，与既有
 *    `.catch(() => null)` 的调用语义一致，迁移不需要在每处加 try/catch。
 *  - **不自动重试**：重试是 sync-engine 的职责（它有退避与幂等键），请求层再做一套会互相打架。
 *  - **不注入业务默认值**：data 解析失败就是 null，调用方决定"保留上次"还是"显示 —"。
 *  - 超时默认关闭（既有行为没有超时）；需要时显式传 timeoutMs，避免迁移改变线上表现。
 */
export type ApiErrorKind = "network" | "timeout" | "auth" | "client" | "server" | "parse" | "aborted";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: ApiErrorKind | null;
}

export interface ApiRequestOptions {
  token?: string | null;
  headers?: Record<string, string>;
  /** 毫秒；不传 = 不设超时（保持迁移前行为） */
  timeoutMs?: number;
}

function joinUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return getApiUrl() + (path.startsWith("/") ? path : "/" + path);
}

function classify(status: number): ApiErrorKind | null {
  if (status === 0) return "network";
  if (status === 401 || status === 403) return "auth";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return null;
}

/**
 * 发一次请求并返回 JSON 结果；永不抛异常。
 * 适合"读数据，失败就降级"的场景（仪表盘、列表、统计）。
 */
export async function apiGetJson<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.token) headers.Authorization = "Bearer " + options.token;

  const controller = options.timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
  try {
    const response = await fetch(joinUrl(path), {
      headers,
      signal: controller?.signal,
    });
    const error = classify(response.status);
    if (!response.ok) {
      return { ok: false, status: response.status, data: null, error: error ?? "client" };
    }
    let data: T | null = null;
    try {
      data = (await response.json()) as T;
    } catch {
      // 204 / 非 JSON：ok 仍为 true（HTTP 成功），但 data 为 null
      return { ok: true, status: response.status, data: null, error: "parse" };
    }
    return { ok: true, status: response.status, data, error: null };
  } catch {
    const aborted = controller?.signal.aborted === true;
    return { ok: false, status: 0, data: null, error: aborted ? "timeout" : "network" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 发写请求（POST/PUT/DELETE）：返回原始 Response 供调用方判断，同样不抛异常。
 * 返回 null 表示请求根本没发出去（断网/超时）。
 */
export async function apiRequest(
  path: string,
  init: RequestInit & { token?: string | null; timeoutMs?: number } = {}
): Promise<Response | null> {
  const { token, timeoutMs, headers: rawHeaders, ...rest } = init;
  const headers: Record<string, string> = { ...((rawHeaders as Record<string, string>) ?? {}) };
  if (token) headers.Authorization = "Bearer " + token;

  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(joinUrl(path), { ...rest, headers, signal: controller?.signal });
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
