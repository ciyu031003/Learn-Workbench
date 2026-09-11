import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/domains/market/analysis", () => ({ analyzeMarket: vi.fn(async () => ({}) ) }));
vi.mock("@/lib/domains/market/public-stats", () => ({
  refreshPublicStats: vi.fn(async () => ({ total: 1 })),
}));
vi.mock("@/lib/domains/market/enrich", () => ({
  backfillMarketJobAttributes: vi.fn(async () => 3),
}));
vi.mock("@/lib/domains/market/snapshots", () => ({
  writeMarketDimensionSnapshots: vi.fn(async () => 9),
}));
vi.mock("@/lib/maintenance", () => ({
  cleanupExpiredData: vi.fn(async () => ({ sessions: 2, authAttempts: 0, resetTokens: 0, syncChanges: 0 })),
  securityAlerts: vi.fn(async () => ({
    failed24h: 3, distinctUsernames: 1, topUsername: "bob", topUsernameCount: 3, alerted: false,
  })),
}));
vi.mock("@/lib/tasks/crawler", () => ({
  crawlerRanSuccessfullyToday: vi.fn(async () => false),
  triggerCrawlerJobs: vi.fn(async () => [{ name: "crawler:official", started: true, runId: 1 }]),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { analyzeMarket } from "@/lib/domains/market/analysis";
import { refreshPublicStats } from "@/lib/domains/market/public-stats";
import { backfillMarketJobAttributes } from "@/lib/domains/market/enrich";
import { writeMarketDimensionSnapshots } from "@/lib/domains/market/snapshots";
import { cleanupExpiredData, securityAlerts } from "@/lib/maintenance";
import { crawlerRanSuccessfullyToday, triggerCrawlerJobs } from "@/lib/tasks/crawler";
import { POST } from "./route";

const analyzeMock = vi.mocked(analyzeMarket);
const refreshStatsMock = vi.mocked(refreshPublicStats);
const backfillMarketMock = vi.mocked(backfillMarketJobAttributes);
const snapshotMock = vi.mocked(writeMarketDimensionSnapshots);
const cleanupMock = vi.mocked(cleanupExpiredData);
const securityMock = vi.mocked(securityAlerts);
const ranTodayMock = vi.mocked(crawlerRanSuccessfullyToday);
const triggerMock = vi.mocked(triggerCrawlerJobs);

function post(job?: string, secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers["x-cron-secret"] = secret;
  const url = job ? `http://localhost/api/internal/cron?job=${job}` : "http://localhost/api/internal/cron";
  return POST(new Request(url, { method: "POST", headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret");
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/internal/cron", () => {
  it("returns 403 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await post("crawl", "s3cret");
    expect(res.status).toBe(403);
  });

  it("returns 403 on a wrong or missing secret", async () => {
    expect((await post("crawl", "wrong")).status).toBe(403);
    expect((await post("crawl")).status).toBe(403);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid job", async () => {
    const res = await post("explode", "s3cret");
    expect(res.status).toBe(400);
  });

  it("triggers the crawler when nothing succeeded today", async () => {
    ranTodayMock.mockResolvedValue(false);
    const res = await post("crawl", "s3cret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crawl.engines).toHaveLength(1);
    expect(body.marketBackfill.enriched).toBe(3);
    expect(triggerMock).toHaveBeenCalledWith("cron", "all");
  });

  it("skips the crawl when one already succeeded today (idempotent re-run)", async () => {
    ranTodayMock.mockResolvedValue(true);
    const res = await post("crawl", "s3cret");
    const body = await res.json();
    expect(body.crawl).toEqual({ skipped: true, reason: "already-succeeded-today" });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("runs the aggregate job with force refresh", async () => {
    const res = await post("aggregate", "s3cret");
    expect(res.status).toBe(200);
    expect(analyzeMock).toHaveBeenCalledWith({ force: true });
    expect(backfillMarketMock).toHaveBeenCalledWith(2000);
    expect(snapshotMock).toHaveBeenCalledTimes(1);
    expect(refreshStatsMock).toHaveBeenCalledTimes(1);
    expect(cleanupMock).not.toHaveBeenCalled();
  });

  it("runs an afternoon backfill-only job", async () => {
    const res = await post("backfill", "s3cret");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(backfillMarketMock).toHaveBeenCalledWith(2000);
    expect(body.backfill).toEqual({ enriched: 3 });
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it("runs the maintenance job with security alert scan", async () => {
    const res = await post("maintenance", "s3cret");
    const body = await res.json();
    expect(body.maintenance).toMatchObject({ sessions: 2 });
    expect(body.security).toMatchObject({ failed24h: 3, alerted: false });
    expect(securityMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("runs all jobs with job=all", async () => {
    ranTodayMock.mockResolvedValue(true);
    const res = await post("all", "s3cret");
    const body = await res.json();
    expect(triggerMock).not.toHaveBeenCalled(); // 今天已成功 → 跳过
    expect(analyzeMock).toHaveBeenCalledWith({ force: true });
    expect(backfillMarketMock).toHaveBeenCalledWith(2000);
    expect(snapshotMock).toHaveBeenCalledTimes(1);
    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(body.ok).toBe(true);
  });
});
