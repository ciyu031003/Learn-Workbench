import { describe, it, expect, vi } from "vitest";
import { parseBody, ApiError } from "./http";

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

