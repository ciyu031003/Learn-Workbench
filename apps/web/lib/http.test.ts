import { describe, it, expect, vi, afterEach } from "vitest";
import { parseBody, ApiError, siteOrigin } from "./http";

function req(body: string | null, init?: RequestInit): Request {
  return new Request("http://localhost", {
    ...(init ?? {}),
    method: init?.method ?? "POST",
    body: body ?? undefined,
  });
}

describe("ApiError", () => {
  it("exposes status and message", () => {
    const err = new ApiError(413, "too big");
    expect(err.status).toBe(413);
    expect(err.message).toBe("too big");
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("siteOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers the configured WEB_BASE_URL over any header", () => {
    vi.stubEnv("WEB_BASE_URL", "https://learn.yuanabd.cn/");
    const r = new Request("http://internal:3000/x", {
      headers: { host: "evil.example", origin: "https://evil.example" },
    });
    expect(siteOrigin(r)).toBe("https://learn.yuanabd.cn");
  });

  it("never trusts the Origin header (reset-link poisoning vector)", () => {
    const r = new Request("https://learn.yuanabd.cn/api/auth/forgot", {
      headers: { origin: "https://evil.example" },
    });
    expect(siteOrigin(r)).toBe("https://learn.yuanabd.cn");
  });

  it("uses forwarded host/proto when nginx proxies the request", () => {
    const r = new Request("http://127.0.0.1:3001/api/auth/forgot", {
      headers: { "x-forwarded-host": "learn.yuanabd.cn", "x-forwarded-proto": "https" },
    });
    expect(siteOrigin(r)).toBe("https://learn.yuanabd.cn");
  });

  it("falls back to the request URL origin", () => {
    expect(siteOrigin(new Request("http://localhost:3001/x"))).toBe("http://localhost:3001");
  });
});

describe("parseBody", () => {
  it("returns the parsed JSON on success", async () => {
    const res = await parseBody(req('{"a":1}'));
    expect(res).toEqual({ ok: true, data: { a: 1 } });
  });

  it("returns null data for an empty body", async () => {
    const res = await parseBody(req("   "));
    expect(res).toEqual({ ok: true, data: null });
  });

  it("returns 400 when the body cannot be read", async () => {
    const bad = new Request("http://localhost", { method: "POST" });
    vi.spyOn(bad, "text").mockRejectedValue(new Error("read failed"));
    const res = await parseBody(bad);
    expect(res).toEqual({ ok: false, status: 400, error: "无法读取请求体" });
  });

  it("returns 413 when the body exceeds maxBytes", async () => {
    const res = await parseBody(req('"'.repeat(10)), 5);
    expect(res).toEqual({ ok: false, status: 413, error: "请求体过大" });
  });

  it("returns 400 when JSON is malformed", async () => {
    const res = await parseBody(req("{not json"));
    expect(res).toEqual({ ok: false, status: 400, error: "JSON 解析失败" });
  });

  it("honours a custom maxBytes limit", async () => {
    const res = await parseBody(req('"'.repeat(100)), 20);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(413);
  });
});

