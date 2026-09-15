import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("GET /api/nutrition/stickers（收集册 · v3 M9）", () => {
  it("按名字聚合次数/热量/首末日期，并给出总计", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [
        { name: "水煮蛋", times: "9", totalKcal: "702", avgKcal: "78", firstDate: "2026-09-01", lastDate: "2026-09-15" },
        { name: "燕麦牛奶", times: "4", totalKcal: "600.4", avgKcal: "150.1", firstDate: "2026-09-03", lastDate: "2026-09-14" },
      ],
    } as never);

    const res = await GET(new Request("http://localhost/api/nutrition/stickers?days=30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(30);
    expect(body.totalKinds).toBe(2);
    expect(body.totalTimes).toBe(13);
    expect(body.stickers[0]).toEqual({
      name: "水煮蛋",
      times: 9,
      totalKcal: 702,
      avgKcal: 78,
      firstDate: "2026-09-01",
      lastDate: "2026-09-15",
    });
    // 四舍五入到整数（UI 直接展示）
    expect(body.stickers[1].totalKcal).toBe(600);
    expect(body.stickers[1].avgKcal).toBe(150);
  });

  it("从 meal_entries 出发（手动录入的名字也能被收集），按次数排序", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost/api/nutrition/stickers"));
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("FROM meal_entries");
    expect(sql).toContain("GROUP BY name");
    expect(sql).toContain("ORDER BY COUNT(*) DESC");
    // 默认 30 天、默认 60 条
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", 30]);
    expect(sql).toContain("LIMIT 60");
  });

  it("days 与 limit 都被钳位", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);

    const big = await (await GET(new Request("http://localhost/api/nutrition/stickers?days=9999&limit=9999"))).json();
    expect(big.days).toBe(365);
    expect(String(queryMock.mock.calls[0][0])).toContain("LIMIT 200");

    const small = await (await GET(new Request("http://localhost/api/nutrition/stickers?days=0&limit=0"))).json();
    expect(small.days).toBe(1);
    expect(String(queryMock.mock.calls[1][0])).toContain("LIMIT 1");
  });

  it("匿名设备走 anon 隔离（不 500）", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    scopeWhereMock.mockImplementation((_scope, base) => ({
      params: [...(base as unknown[]), "anon-1"],
      sql: " AND (anon_id IS NULL OR anon_id IS NOT DISTINCT FROM $3)",
    }));
    queryMock.mockResolvedValue({ rows: [] } as never);

    const res = await GET(new Request("http://localhost/api/nutrition/stickers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ days: 30, totalKinds: 0, totalTimes: 0, stickers: [] });
    expect(queryMock.mock.calls[0][1]).toEqual([null, 30, "anon-1"]);
  });

  // 回归：缺失参数不能用 Number(null)=0 去钳位（否则默认会退化成 1 天 / 1 条）
  it("参数缺失时用默认值而不是最小值", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);

    const res = await GET(new Request("http://localhost/api/nutrition/stickers"));
    const body = await res.json();
    expect(body.days).toBe(30);
    expect(String(queryMock.mock.calls[0][0])).toContain("LIMIT 60");

    queryMock.mockClear();
    const empty = await (await GET(new Request("http://localhost/api/nutrition/stickers?days=&limit="))).json();
    expect(empty.days).toBe(30);
    expect(String(queryMock.mock.calls[0][0])).toContain("LIMIT 60");
  });
});
