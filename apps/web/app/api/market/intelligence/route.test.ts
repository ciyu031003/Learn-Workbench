import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/domains/market/intelligence", () => ({
  queryMarketIntelligence: vi.fn(async () => ({ total: 12 })),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn() }));
vi.mock("@/lib/auth", () => ({ clientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));

import { queryMarketIntelligence } from "@/lib/domains/market/intelligence";
import { userScope } from "@/lib/anon";
import { rateLimit } from "@/lib/rate-limit";
import { GET } from "./route";

const queryMock = vi.mocked(queryMarketIntelligence);
const scopeMock = vi.mocked(userScope);
const rateLimitMock = vi.mocked(rateLimit);

function req(qs = "") {
  return new Request("http://localhost/api/market/intelligence" + qs);
}

beforeEach(() => {
  vi.resetAllMocks();
  scopeMock.mockResolvedValue({ uid: null, anonId: "dev-1" });
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  queryMock.mockResolvedValue({ total: 12 } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/market/intelligence", () => {
  it("parses filters from the query string", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/market/intelligence?city=%E6%B7%B1%E5%9C%B3&function=%E5%90%8E%E7%AB%AF&range=30&salaryMin=15"
      )
    );
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ city: "深圳", functionKey: "后端", range: 30, salaryMin: 15 })
    );
  });

  it("公开只读聚合下发 public s-maxage=60 + SWR=120（S5-5）", async () => {
    const response = await GET(req("?city=A"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60, stale-while-revalidate=120");
    expect(response.headers.get("X-Cache")).toBe("MISS");
  });

  it("同一筛选条件 60s 内不重复打库（进程内缓存命中）", async () => {
    const first = await GET(req("?city=B"));
    const second = await GET(req("?city=B"));
    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("HIT");
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(second.headers.get("Cache-Control")).toContain("public");
  });

  it("超过 60s 缓存失效，重新打库", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    await GET(req("?city=C"));
    vi.setSystemTime(new Date("2026-10-19T00:01:01Z"));
    const second = await GET(req("?city=C"));
    expect(second.headers.get("X-Cache")).toBe("MISS");
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("不同筛选条件各自缓存（互不串数据）", async () => {
    await GET(req("?city=D"));
    await GET(req("?city=E"));
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("匿名限流：超限返回 429 + retryAfter + no-store（S2 rate-limit 复用）", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const response = await GET(req("?city=F"));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ retryAfter: 42 });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(rateLimitMock).toHaveBeenCalledWith("market-intelligence:dev-1", { limit: 60, windowMs: 60_000 });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("查询失败：500 且不缓存错误", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(req("?city=G"));
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
