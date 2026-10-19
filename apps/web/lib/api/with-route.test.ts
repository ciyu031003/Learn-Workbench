import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn() }));
vi.mock("@/lib/auth", () => ({ clientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/anon-quota", () => ({ assertAnonWriteAllowed: vi.fn() }));
vi.mock("@/lib/internal-guard", () => ({ guardInternalRequest: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
}));

import { currentUserId } from "@/lib/session";
import { userScope } from "@/lib/anon";
import { rateLimit } from "@/lib/rate-limit";
import { guardInternalRequest } from "@/lib/internal-guard";
import { assertAnonWriteAllowed } from "@/lib/anon-quota";
import { readJsonBody, withRoute } from "./with-route";

const currentUserIdMock = vi.mocked(currentUserId);
const userScopeMock = vi.mocked(userScope);
const rateLimitMock = vi.mocked(rateLimit);
const guardMock = vi.mocked(guardInternalRequest);
const quotaMock = vi.mocked(assertAnonWriteAllowed);

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  quotaMock.mockResolvedValue({ ok: true, count: 0, limit: 500 });
});

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("withRoute · 鉴权", () => {
  it("user 模式未登录 → 401，且响应带 requestId", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const handler = vi.fn();
    const route = withRoute({ auth: "user" }, handler);
    const res = await route(post("/api/x", { a: 1 }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "请先登录", code: "unauthorized" });
    expect(res.headers.get("x-request-id")).toBe(body.requestId);
    expect(handler).not.toHaveBeenCalled();
  });

  it("anon 模式：匿名写没有设备标识 → 400（S1-7 fail-closed）", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: null });
    const handler = vi.fn();
    const route = withRoute({ auth: "anon" }, handler);
    const res = await route(post("/api/x", { a: 1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("缺少设备标识");
    expect(handler).not.toHaveBeenCalled();
  });

  it("anon 写超配额 → 429 quota_exceeded 且 handler 不执行", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "dev-1" });
    quotaMock.mockResolvedValue({ ok: false, reason: "quota", count: 500, limit: 500 });
    const handler = vi.fn();
    const route = withRoute({ auth: "anon", anonWriteTable: "log_entries" }, handler);
    const res = await route(post("/api/x", { a: 1 }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("quota_exceeded");
    expect(quotaMock).toHaveBeenCalledWith({ uid: null, anonId: "dev-1" }, "log_entries");
    expect(handler).not.toHaveBeenCalled();
  });

  it("anon 模式：匿名读允许无设备标识", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: null });
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const route = withRoute({ auth: "anon" }, handler);
    const res = await route(new Request("http://localhost/api/x", { method: "GET" }));
    expect(res.status).toBe(200);
  });

  it("internal 模式：guard 拦截时直接返回", async () => {
    guardMock.mockResolvedValue({
      ok: false,
      requestId: "r-1",
      response: Response.json({ error: "未授权" }, { status: 403 }),
    } as never);
    const handler = vi.fn();
    const route = withRoute({ auth: "internal", internalName: "x" }, handler);
    const res = await route(post("/api/internal/x", {}));
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withRoute · 限流与请求体", () => {
  it("限流命中 → 429 + retryAfterSeconds", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const route = withRoute({ auth: "user", limit: { n: 3, windowMs: 1000 } }, vi.fn());
    const res = await route(post("/api/x", {}));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ code: "rate_limited", retryAfterSeconds: 42 });
    expect(rateLimitMock).toHaveBeenCalledWith("user:u-1", { limit: 3, windowMs: 1000 });
  });

  it("请求体超过 bodyLimit → 413（流式截断，不缓冲到内存）", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const route = withRoute({ auth: "user", bodyLimit: 32 }, vi.fn());
    const res = await route(post("/api/x", { a: "x".repeat(100) }));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("请求体过大");
  });

  it("非法 JSON → 400", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const route = withRoute({ auth: "user" }, vi.fn());
    const res = await route(post("/api/x", "not-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("JSON 解析失败");
  });

  it("schema 校验失败 → 400 validation_failed，handler 不执行", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const handler = vi.fn();
    const route = withRoute({ auth: "user", schema: z.object({ title: z.string().min(1) }) }, handler);
    const res = await route(post("/api/x", { title: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("validation_failed");
    expect(handler).not.toHaveBeenCalled();
  });

  it("schema 通过时 ctx.body 为解析结果、rawBody 保留原值", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const route = withRoute(
      { auth: "user", schema: z.object({ title: z.string() }) },
      async ({ body, rawBody, uid }) =>
        Response.json({ title: body.title, extra: (rawBody as Record<string, unknown>).extra, uid })
    );
    const res = await route(post("/api/x", { title: "t", extra: 1 }));
    expect(await res.json()).toEqual({ title: "t", extra: 1, uid: "u-1" });
  });
});

describe("withRoute · 错误与缓存", () => {
  it("handler 抛错 → 500 统一 envelope + requestId（不泄漏异常信息）", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const route = withRoute({ auth: "user" }, async () => {
      throw new Error("boom secret detail");
    });
    const res = await route(post("/api/x", {}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ code: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("boom secret detail");
  });

  it("用户态默认 Cache-Control: private, no-store；public 可声明 s-maxage", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const userRoute = withRoute({ auth: "user" }, async () => Response.json({ ok: true }));
    const r1 = await userRoute(post("/api/x", {}));
    expect(r1.headers.get("cache-control")).toBe("private, no-store");

    const pubRoute = withRoute({ auth: "public", cache: { sMaxAge: 60, swr: 30 } }, async () =>
      Response.json({ ok: true })
    );
    const r2 = await pubRoute(new Request("http://localhost/api/public/x", { method: "GET" }));
    expect(r2.headers.get("cache-control")).toBe("public, s-maxage=60, stale-while-revalidate=30");
  });
});

describe("withRoute · 指标埋点（S4-5）", () => {
  it("请求结束会记录 lwb_http_requests_total（method/status 标签，低基数）", async () => {
    const { renderMetrics } = await import("@/lib/metrics");
    currentUserIdMock.mockResolvedValue("u-1");
    const route = withRoute({ auth: "user" }, async () => Response.json({ ok: true }));
    await route(post("/api/x", {}));
    const text = renderMetrics();
    expect(text).toContain("lwb_http_requests_total");
    expect(text).toContain('method="POST"');
    expect(text).toContain('status="200"');
    // 基数纪律：不得把 path 放进标签
    expect(text).not.toContain('path="/api/x"');
  });
});

describe("readJsonBody", () => {
  it("空 body 返回 null，不抛错", async () => {
    const res = await readJsonBody(new Request("http://localhost/x", { method: "POST" }), 100);
    expect(res).toEqual({ ok: true, data: null });
  });

  it("超过上限返回 413", async () => {
    const res = await readJsonBody(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ a: 1 }) }),
      4
    );
    expect(res).toMatchObject({ ok: false, status: 413 });
  });
});
