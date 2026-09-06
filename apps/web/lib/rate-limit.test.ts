import { describe, it, expect, beforeEach, vi } from "vitest";

const redisEval = vi.fn();
const redisPttl = vi.fn();

vi.mock("./redis", () => ({
  getRedis: vi.fn(() =>
    process.env.REDIS_URL_TEST ? { eval: redisEval, pttl: redisPttl } : null
  ),
}));
vi.mock("./logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { rateLimit, resetRateLimits } from "./rate-limit";
import { getRedis } from "./redis";

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.REDIS_URL_TEST;
});

describe("rateLimit (in-process)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows the first request in a window", async () => {
    const res = await rateLimit("ip:1", { limit: 2, windowMs: 60_000 });
    expect(res).toEqual({ ok: true, retryAfterSeconds: 0 });
  });

  it("allows requests up to the limit", async () => {
    expect((await rateLimit("k", { limit: 3, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit("k", { limit: 3, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit("k", { limit: 3, windowMs: 60_000 })).ok).toBe(true);
  });

  it("rejects requests beyond the limit with a retry window", async () => {
    for (let i = 0; i < 2; i++) await rateLimit("k", { limit: 2, windowMs: 60_000 });
    const res = await rateLimit("k", { limit: 2, windowMs: 60_000 });
    expect(res.ok).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the window after it expires", async () => {
    await rateLimit("k", { limit: 1, windowMs: 60_000 });
    expect((await rateLimit("k", { limit: 1, windowMs: 60_000 })).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect((await rateLimit("k", { limit: 1, windowMs: 60_000 })).ok).toBe(true);
  });

  it("tracks independent keys separately", async () => {
    await rateLimit("a", { limit: 1, windowMs: 60_000 });
    expect((await rateLimit("b", { limit: 1, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit("a", { limit: 1, windowMs: 60_000 })).ok).toBe(false);
  });
});

describe("rateLimit (redis backend)", () => {
  beforeEach(() => {
    process.env.REDIS_URL_TEST = "1";
  });

  it("uses the atomic lua script and allows below the limit", async () => {
    redisEval.mockResolvedValue(2);
    const res = await rateLimit("login:1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(res).toEqual({ ok: true, retryAfterSeconds: 0 });
    expect(redisEval).toHaveBeenCalledWith(expect.stringContaining("INCR"), 1, "lwb:rl:login:1.2.3.4", "60000");
  });

  it("blocks with the key's remaining ttl beyond the limit", async () => {
    redisEval.mockResolvedValue(6);
    redisPttl.mockResolvedValue(23_000);
    const res = await rateLimit("login:1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(res).toEqual({ ok: false, retryAfterSeconds: 23 });
    expect(redisPttl).toHaveBeenCalledWith("lwb:rl:login:1.2.3.4");
  });

  it("falls back to in-process when redis errors", async () => {
    redisEval.mockRejectedValue(new Error("connection refused"));
    const first = await rateLimit("fallback-k", { limit: 1, windowMs: 60_000 });
    expect(first.ok).toBe(true);
    const second = await rateLimit("fallback-k", { limit: 1, windowMs: 60_000 });
    expect(second.ok).toBe(false);
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("stays in-process when REDIS_URL is not configured", async () => {
    delete process.env.REDIS_URL_TEST;
    expect(getRedis()).toBeNull();
    const res = await rateLimit("mem-k", { limit: 1, windowMs: 60_000 });
    expect(res.ok).toBe(true);
    expect(redisEval).not.toHaveBeenCalled();
  });
});
