import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows the first request in a window", () => {
    const res = rateLimit("ip:1", { limit: 2, windowMs: 60_000 });
    expect(res).toEqual({ ok: true, retryAfterSeconds: 0 });
  });

  it("allows requests up to the limit", () => {
    expect(rateLimit("k", { limit: 3, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit("k", { limit: 3, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit("k", { limit: 3, windowMs: 60_000 }).ok).toBe(true);
  });

  it("rejects requests beyond the limit with a retry window", () => {
    for (let i = 0; i < 2; i++) rateLimit("k", { limit: 2, windowMs: 60_000 });
    const res = rateLimit("k", { limit: 2, windowMs: 60_000 });
    expect(res.ok).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the window after it expires", () => {
    rateLimit("k", { limit: 1, windowMs: 60_000 });
    expect(rateLimit("k", { limit: 1, windowMs: 60_000 }).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit("k", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("tracks independent keys separately", () => {
    rateLimit("a", { limit: 1, windowMs: 60_000 });
    expect(rateLimit("b", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit("a", { limit: 1, windowMs: 60_000 }).ok).toBe(false);
  });
});

