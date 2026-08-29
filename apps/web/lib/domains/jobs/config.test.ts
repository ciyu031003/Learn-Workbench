import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { getCrawlerConfig, saveCrawlerConfig } from "./config";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("getCrawlerConfig", () => {
  it("returns default config when no row exists", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const cfg = await getCrawlerConfig("u-1");
    expect(cfg.keywords).toEqual([]);
    expect(cfg.scheduleTime).toBe("08:00");
    expect(cfg.enabled).toBe(true);
  });

  it("normalizes platforms/categories/provinces and null/absent fields", async () => {
    queryMock.mockResolvedValue({
      rows: [{
        keywords: ["网络安全"],
        industries: ["互联网"],
        cities: ["上海"],
        platforms: ["lagou", "not-a-source", "boss"],
        categories: ["internet", "unknown-cat"],
        provinces: ["广东"],
        sources: ["zhilian"],
        schedule_time: "18:30",
        enabled: true,
        max_pages: 5,
        last_run_at: "2026-08-01T00:00:00Z",
      }],
    } as never);
    const cfg = await getCrawlerConfig("u-1");
    expect(cfg.keywords).toEqual(["网络安全"]);
    expect(cfg.platforms).toEqual(["lagou", "boss"]);
    expect(cfg.categories).toEqual(["internet"]);
    expect(cfg.provinces).toEqual(["广东"]);
    expect(cfg.scheduleTime).toBe("18:30");
    expect(cfg.enabled).toBe(true);
    expect(cfg.maxPages).toBe(5);
    expect(cfg.lastRunAt).toBe("2026-08-01T00:00:00Z");
  });

  it("falls back to default platforms when platforms is not an array", async () => {
    queryMock.mockResolvedValue({ rows: [{ platforms: null, categories: [] }] } as never);
    const cfg = await getCrawlerConfig("u-1");
    expect(Array.isArray(cfg.platforms)).toBe(true);
    expect(cfg.platforms.length).toBeGreaterThan(0);
    expect(cfg.enabled).toBe(false);
  });
});

describe("saveCrawlerConfig", () => {
  it("persists all fields with the user id", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await saveCrawlerConfig("u-1", {
      keywords: ["AI"],
      industries: [],
      cities: ["深圳"],
      platforms: ["boss"],
      categories: ["internet"],
      provinces: [],
      sources: [],
      scheduleTime: "09:00",
      enabled: true,
      maxPages: 4,
      lastRunAt: null,
    });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (user_id) DO UPDATE"),
      ["u-1", '["AI"]', "[]", '["深圳"]', '["boss"]', '["internet"]', "[]", "[]", "09:00", true, 4]
    );
  });
});


