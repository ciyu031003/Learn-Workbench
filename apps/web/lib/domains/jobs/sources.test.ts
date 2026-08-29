import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { listJobSources, getHostsMeta, sourceHealth } from "./sources";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("listJobSources", () => {
  it("maps db rows to JobSourceInfo and normalizes hit rate", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { id: 1, category: "internet", channel: "job", name: "拉勾", engine: "x", base_url: "https://a", risk: "low", enabled: true, hit_rate: 0.8, last_run_at: "2026-08-01T00:00:00Z", last_error: null, note: "" },
        { id: 2, category: "official", channel: "announcement", name: "官网", engine: "y", base_url: "https://b", risk: "high", enabled: false, hit_rate: null, last_run_at: null, last_error: "err", note: "n" },
      ],
    } as never);
    const rows = await listJobSources();
    expect(rows[0].enabled).toBe(true);
    expect(rows[0].hitRate).toBe(0.8);
    expect(rows[0].lastRunAt).toBe("2026-08-01T00:00:00.000Z");
    expect(rows[1].hitRate).toBe(1);
    expect(rows[1].lastRunAt).toBeNull();
    expect(rows[1].lastError).toBe("err");
  });
});

describe("getHostsMeta", () => {
  it("returns null when no meta row", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    expect(await getHostsMeta()).toBeNull();
  });

  it("parses version/updatedAt from the meta value", async () => {
    queryMock.mockResolvedValue({ rows: [{ version: "3", updated_at: "2026-08-01T00:00:00Z" }] } as never);
    const meta = await getHostsMeta();
    expect(meta?.version).toBe(3);
    expect(meta?.updatedAt).toBe("2026-08-01T00:00:00Z");
  });
});

describe("sourceHealth", () => {
  it("queries without source filter", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await sourceHealth();
    expect(queryMock.mock.calls[0][1]).toEqual([14]);
  });

  it("adds source filter when provided", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await sourceHealth("lagou", 7);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("WHERE source = $2");
    expect(args).toEqual([7, "lagou"]);
  });

  it("maps rows to JobSourceHealth with ISO dates", async () => {
    queryMock.mockResolvedValue({
      rows: [{ id: 1, source: "lagou", fetched: 10, hit_rate: 0.5, error: null, created_at: "2026-08-01T00:00:00Z" }],
    } as never);
    const rows = await sourceHealth();
    expect(rows[0].hitRate).toBe(0.5);
    expect(rows[0].error).toBe("");
    expect(rows[0].createdAt).toBe("2026-08-01T00:00:00.000Z");
  });
});
