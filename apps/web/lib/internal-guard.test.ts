import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { guardInternalRequest } from "./internal-guard";
import { resetRateLimits } from "./rate-limit";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/internal/x", { method: "POST", headers });
}

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  resetRateLimits();
  process.env.CRON_SECRET = "s3cr3t";
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("guardInternalRequest（H2 内部接口前门）", () => {
  it("密钥正确 → 放行，并给出 requestId", async () => {
    const res = await guardInternalRequest(req({ "x-cron-secret": "s3cr3t" }), "t");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.requestId).toBeTruthy();
  });

  it("CRON_SECRET 未配置 → 一律 403（不放行任何请求）", async () => {
    delete process.env.CRON_SECRET;
    const res = await guardInternalRequest(req({ "x-cron-secret": "s3cr3t" }), "t");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(403);
      expect(await res.response.json()).toMatchObject({ code: "forbidden" });
    }
  });

  it("密钥不匹配 → 403 forbidden", async () => {
    const res = await guardInternalRequest(req({ "x-cron-secret": "wrong" }), "t");
    expect(res.ok).toBe(false);
    if (!res.ok) expect((await res.response.json()).code).toBe("forbidden");
  });

  it("超过窗口阈值 → 429 rate_limited，且仍带 requestId", async () => {
    const opts = { limit: 2, windowMs: 60_000 };
    expect((await guardInternalRequest(req({ "x-cron-secret": "s3cr3t" }), "burst", opts)).ok).toBe(true);
    expect((await guardInternalRequest(req({ "x-cron-secret": "s3cr3t" }), "burst", opts)).ok).toBe(true);
    const third = await guardInternalRequest(req({ "x-cron-secret": "s3cr3t" }), "burst", opts);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.response.status).toBe(429);
      expect(await third.response.json()).toMatchObject({ code: "rate_limited" });
    }
  });

  it("先限流再验密钥：错密钥探测也会被计入桶（防止无限探测）", async () => {
    const opts = { limit: 1, windowMs: 60_000 };
    await guardInternalRequest(req({ "x-cron-secret": "wrong" }), "probe", opts);
    const second = await guardInternalRequest(req({ "x-cron-secret": "s3cr3t" }), "probe", opts);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.response.status).toBe(429);
  });
});
