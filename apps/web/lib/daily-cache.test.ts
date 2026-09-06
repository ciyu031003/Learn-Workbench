import { describe, it, expect, beforeEach, vi } from "vitest";

const redisGet = vi.fn();
const redisSet = vi.fn();

vi.mock("./redis", () => ({
  getRedis: vi.fn(() =>
    process.env.REDIS_URL_TEST ? { get: redisGet, set: redisSet } : null
  ),
}));
vi.mock("./logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { dailyCacheGet, dailyCacheSet, resetDailyCache } from "./daily-cache";

beforeEach(() => {
  vi.clearAllMocks();
  resetDailyCache();
  delete process.env.REDIS_URL_TEST;
});

describe("dailyCache (in-process)", () => {
  it("round-trips a value within ttl", async () => {
    await dailyCacheSet("k", { tip: "hi" }, 60_000);
    expect(await dailyCacheGet<{ tip: string }>("k")).toEqual({ tip: "hi" });
  });

  it("expires after ttl", async () => {
    vi.useFakeTimers();
    await dailyCacheSet("k", 1, 1_000);
    vi.advanceTimersByTime(1_001);
    expect(await dailyCacheGet("k")).toBeNull();
    vi.useRealTimers();
  });

  it("returns null for a missing key", async () => {
    expect(await dailyCacheGet("missing")).toBeNull();
  });
});

describe("dailyCache (redis backend)", () => {
  beforeEach(() => {
    process.env.REDIS_URL_TEST = "1";
  });

  it("reads and writes through redis", async () => {
    redisGet.mockResolvedValue(JSON.stringify({ tip: "from-redis" }));
    await dailyCacheSet("k", { tip: "from-redis" }, 60_000);
    expect(redisSet).toHaveBeenCalledWith("lwb:cache:k", JSON.stringify({ tip: "from-redis" }), "PX", 60_000);
    expect(await dailyCacheGet<{ tip: string }>("k")).toEqual({ tip: "from-redis" });
  });

  it("falls back to in-process on redis read failure", async () => {
    redisGet.mockRejectedValue(new Error("connection refused"));
    expect(await dailyCacheGet("k")).toBeNull();
    // 写也失败 → 落进程内，仍然可读
    redisSet.mockRejectedValue(new Error("connection refused"));
    await dailyCacheSet("k2", "v", 60_000);
    expect(await dailyCacheGet("k2")).toBe("v");
  });
});
