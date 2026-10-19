import { describe, expect, it } from "vitest";
import {
  CACHE_PRIVATE_NO_STORE,
  CACHE_PUBLIC_AGGREGATE_60,
  applyCacheControl,
  publicAggregateCacheControl,
  withPrivateNoStore,
} from "./cache";

describe("cache header policy (S5-5)", () => {
  it("用户态一律 private, no-store", () => {
    expect(CACHE_PRIVATE_NO_STORE).toBe("private, no-store");
  });

  it("公开只读聚合默认 60s s-maxage + 120s SWR", () => {
    expect(CACHE_PUBLIC_AGGREGATE_60).toBe("public, s-maxage=60, stale-while-revalidate=120");
    expect(publicAggregateCacheControl(30, 0)).toBe("public, s-maxage=30");
  });

  it("applyCacheControl 原地写头并返回同一个 Response", () => {
    const res = new Response("{}");
    const out = applyCacheControl(res, CACHE_PUBLIC_AGGREGATE_60);
    expect(out).toBe(res);
    expect(out.headers.get("Cache-Control")).toBe(CACHE_PUBLIC_AGGREGATE_60);
  });

  it("withPrivateNoStore 给业务响应加 no-store", () => {
    const res = new Response("{}", { status: 201 });
    const out = withPrivateNoStore(res);
    expect(out.headers.get("Cache-Control")).toBe("private, no-store");
    expect(out.status).toBe(201);
  });
});
