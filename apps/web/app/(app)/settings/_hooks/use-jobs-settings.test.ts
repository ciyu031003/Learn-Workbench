import { describe, expect, it, vi } from "vitest";
import {
  buildSubscriptionPayload,
  fetchJobsSettings,
  patchCrawler,
  saveJobsConfig,
  startJobsCrawlerRun,
  toggleListValue,
  type Fetcher,
} from "./use-jobs-settings";
import type { JobCrawlerConfig } from "@learn-workbench/shared/schemas";

const baseConfig: JobCrawlerConfig = {
  keywords: ["a"],
  industries: [],
  cities: [],
  platforms: ["lagou"],
  categories: ["internet"],
  provinces: [],
  sources: [],
  scheduleTime: "08:00",
  enabled: true,
  maxPages: 3,
  lastRunAt: null,
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("useJobsSettings 的纯逻辑/网络函数（S6-4）", () => {
  it("toggleListValue 在列表里增删（不改原数组）", () => {
    const list = ["a", "b"];
    expect(toggleListValue(list, "b")).toEqual(["a"]);
    expect(toggleListValue(list, "c")).toEqual(["a", "b", "c"]);
    expect(list).toEqual(["a", "b"]);
  });

  it("patchCrawler 只做不可变合并；null 保持 null", () => {
    const next = patchCrawler(baseConfig, { enabled: false, cities: ["北京"] });
    expect(next?.enabled).toBe(false);
    expect(next?.cities).toEqual(["北京"]);
    expect(baseConfig.enabled).toBe(true);
    expect(patchCrawler(null, { enabled: false })).toBeNull();
  });

  it("buildSubscriptionPayload 默认启用订阅", () => {
    expect(buildSubscriptionPayload({ name: "n", categories: [], keywords: [], cities: [] })).toEqual({
      subscription: { name: "n", categories: [], keywords: [], cities: [], enabled: true },
    });
    expect(buildSubscriptionPayload({ name: "n", categories: [], keywords: [], cities: [], enabled: false }).subscription.enabled).toBe(false);
  });

  it("fetchJobsSettings：部分接口失败时返回其余数据 + 错误清单", async () => {
    const fetcher: Fetcher = vi.fn(async (input: string) => {
      if (input === "/api/jobs/config") return jsonResponse({ config: baseConfig });
      if (input === "/api/jobs/runs") return jsonResponse({ runs: [] });
      if (input === "/api/jobs/stats") return jsonResponse({}, false, 500);
      if (input === "/api/jobs/sources") return jsonResponse({ sources: [{ id: "s1", name: "官方", enabled: true, risk: "L1", hitRate: 0.9 }], version: 3, updatedAt: null });
      return jsonResponse({ subscriptions: [{ id: 1, name: "sub", categories: [], keywords: [], cities: [], enabled: true }] });
    });
    const data = await fetchJobsSettings(fetcher);
    expect(data.config?.enabled).toBe(true);
    expect(data.version).toBe(3);
    expect(data.errors.length).toBeGreaterThan(0);
    expect((data as { subscriptions?: unknown[] }).subscriptions?.length).toBe(1);
  });

  it("saveJobsConfig 成功返回新配置；失败抛出后端错误文案", async () => {
    const fetcher: Fetcher = vi.fn(async () => jsonResponse({ config: { ...baseConfig, enabled: false } }));
    await expect(saveJobsConfig(fetcher, baseConfig)).resolves.toMatchObject({ enabled: false });
    const bad: Fetcher = vi.fn(async () => jsonResponse({ error: "只能管理员操作" }, false, 403));
    await expect(saveJobsConfig(bad, baseConfig)).rejects.toThrow("只能管理员操作");
  });

  it("startJobsCrawlerRun 成功 resolve、失败抛出", async () => {
    await expect(startJobsCrawlerRun(async () => jsonResponse({ ok: true }))).resolves.toBeUndefined();
    await expect(startJobsCrawlerRun(async () => jsonResponse({ error: "已有一轮在跑" }, false, 409))).rejects.toThrow("已有一轮在跑");
  });
});
