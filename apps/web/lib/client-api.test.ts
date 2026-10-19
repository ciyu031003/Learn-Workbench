import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiMutate, isAbortError } from "./client-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiGet", () => {
  it("2xx JSON 正常解析", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ phases: [1, 2] })));
    await expect(apiGet<{ phases: number[] }>("/api/roadmap")).resolves.toEqual({ phases: [1, 2] });
  });

  it("非 2xx -> ApiError(status, code, message)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "数据库暂不可用", code: "db_down" }, 500)));
    await expect(apiGet("/api/roadmap")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      code: "db_down",
      message: "数据库暂不可用",
    });
  });

  it("401 -> 跳登录（带 from）并抛 ApiError", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/roadmap", search: "?x=1", assign } });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "请先登录" }, 401)));
    await expect(apiGet("/api/roadmap")).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith("/login?from=" + encodeURIComponent("/roadmap?x=1"));
  });

  it("401 且 redirectOn401=false 时不跳转（登录页/探测请求）", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/roadmap", search: "", assign } });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "请先登录" }, 401)));
    await expect(apiGet("/api/auth/me", { redirectOn401: false })).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  it("已在登录页时 401 不再跳转（防循环）", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/login", search: "", assign } });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "bad" }, 401)));
    await expect(apiGet("/api/x")).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  it("网络错误 -> ApiError(0, NETWORK)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(apiGet("/api/x")).rejects.toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("超时 -> ApiError(0, TIMEOUT)", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    })));
    await expect(apiGet("/api/x", { timeoutMs: 10 })).rejects.toMatchObject({ status: 0, code: "TIMEOUT" });
  });

  it("调用方主动取消 -> 原样抛 AbortError（页面按取消忽略）", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    })));
    const pending = apiGet("/api/x", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toSatisfy((e: unknown) => isAbortError(e));
  });

  it("2xx 但 JSON 解析失败 -> 兜底返回 fallback（默认 null，不白屏）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oops</html>", { status: 200 })));
    await expect(apiGet("/api/x")).resolves.toBeNull();
    await expect(apiGet("/api/x", { fallback: { ok: false } })).resolves.toEqual({ ok: false });
  });

  it("204 空响应 -> fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(apiGet("/api/x", { fallback: [] })).resolves.toEqual([]);
  });
});

describe("apiMutate", () => {
  it("默认 POST + JSON body + content-type", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiMutate("/api/progress", "POST", { topicId: 1, done: true })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/progress");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ topicId: 1, done: true }));
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("DELETE 无 body 时不带 content-type", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await apiMutate("/api/roadmap/custom?topicId=3", "DELETE");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string> | undefined)?.["content-type"]).toBeUndefined();
  });
});
