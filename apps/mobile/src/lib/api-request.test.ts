import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test" }));

const { apiGetJson, apiRequest } = await import("./api-request");

function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(impl as never);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("apiGetJson", () => {
  it("returns parsed data and attaches the bearer token", async () => {
    const fn = mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ hello: "world" }) }));
    const res = await apiGetJson<{ hello: string }>("/api/x", { token: "t1" });
    expect(res).toEqual({ ok: true, status: 200, data: { hello: "world" }, error: null });
    expect(fn).toHaveBeenCalledTimes(1);
    const calls = (fn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const [url, init] = calls[0];
    expect(url).toBe("https://api.test/api/x");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t1");
  });

  it("maps 401 to auth without throwing", async () => {
    mockFetch(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const res = await apiGetJson("/api/private");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("auth");
    expect(res.data).toBeNull();
  });

  it("maps 500 to server and network failure to network", async () => {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => null }));
    expect((await apiGetJson("/api/x")).error).toBe("server");
    mockFetch(async () => {
      throw new TypeError("Network request failed");
    });
    const res = await apiGetJson("/api/x");
    expect(res).toEqual({ ok: false, status: 0, data: null, error: "network" });
  });

  it("keeps ok=true but data=null when the body is not JSON", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
    }));
    const res = await apiGetJson("/api/x");
    expect(res.ok).toBe(true);
    expect(res.status).toBe(204);
    expect(res.data).toBeNull();
    expect(res.error).toBe("parse");
  });
});

describe("apiRequest", () => {
  it("returns the raw response for writes", async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const res = await apiRequest("/api/habits/logs", { method: "POST", token: "t" });
    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
  });

  it("returns null instead of throwing when the network is down", async () => {
    mockFetch(async () => {
      throw new Error("offline");
    });
    expect(await apiRequest("/api/habits/logs", { method: "DELETE" })).toBeNull();
  });
});
