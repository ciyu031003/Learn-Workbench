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

describe("GET /api/nutrition/summary", () => {
  it("默认 7 天窗口，按日汇总并补齐空日", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [
        { date: "2026-09-13", kcal: "0", proteinG: "0", carbsG: "0", fatG: "0", entryCount: "0" },
        { date: "2026-09-14", kcal: "321.4", proteinG: "43.6", carbsG: "12", fatG: "14.2", entryCount: "2" },
        { date: "2026-09-15", kcal: "1800", proteinG: "90", carbsG: "210", fatG: "55", entryCount: "5" },
      ],
    } as never);

    const res = await GET(new Request("http://localhost/api/nutrition/summary?days=7"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(7);
    expect(body.summary).toHaveLength(3);
    // 四舍五入到整数（UI 直接展示）
    expect(body.summary[1]).toEqual({
      date: "2026-09-14",
      kcal: 321,
      proteinG: 44,
      carbsG: 12,
      fatG: 14,
      entryCount: 2,
    });
    // SQL 用 generate_series 补齐空日，避免前端缺列
    expect(String(queryMock.mock.calls[0][0])).toContain("generate_series");
  });

  it("days 被钳位在 1..31", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);

    await GET(new Request("http://localhost/api/nutrition/summary?days=999"));
    const body999 = await (await GET(new Request("http://localhost/api/nutrition/summary?days=999"))).json();
    expect(body999.days).toBe(31);

    const bodyNeg = await (await GET(new Request("http://localhost/api/nutrition/summary?days=-5"))).json();
    expect(bodyNeg.days).toBe(1);

    const bodyBad = await (await GET(new Request("http://localhost/api/nutrition/summary?days=abc"))).json();
    expect(bodyBad.days).toBe(7);
  });

  it("合法 end 参数参与 SQL（历史窗口），非法 end 回落今天", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);

    await GET(new Request("http://localhost/api/nutrition/summary?days=3&end=2026-09-10"));
    const sqlWithEnd = String(queryMock.mock.calls[0][0]);
    expect(sqlWithEnd).toContain("$2::date");
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", "2026-09-10", 3]);

    queryMock.mockClear();
    await GET(new Request("http://localhost/api/nutrition/summary?days=3&end=nope"));
    const sqlNoEnd = String(queryMock.mock.calls[0][0]);
    expect(sqlNoEnd).toContain("CURRENT_DATE");
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", 3]);
  });

  it("匿名设备也能取（走 anon 隔离）", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    scopeWhereMock.mockImplementation((_scope, base) => ({
      params: [...(base as unknown[]), "anon-1"],
      sql: " AND (anon_id IS NULL OR anon_id IS NOT DISTINCT FROM $2)",
    }));
    queryMock.mockResolvedValue({ rows: [] } as never);

    const res = await GET(new Request("http://localhost/api/nutrition/summary?days=7"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toEqual([]);
  });
});
