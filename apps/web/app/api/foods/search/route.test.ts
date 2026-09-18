import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);

beforeEach(() => {
  vi.resetAllMocks();
  userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
});

describe("GET /api/foods/search（v6 P1-3 营养基准库模糊搜索）", () => {
  it("没有关键词时不查库，直接返回空", async () => {
    const res = await GET(new Request("http://localhost/api/foods/search"));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("命中名称/别名/拼音 + trgm 容错，并带基准量与许可字段", async () => {
    queryMock.mockResolvedValue({
      rows: [{ id: 12, name: "番茄鸡蛋面", basisAmount: "500", basisUnit: "g", kcal: "480", score: 1, license: "own" }],
    } as never);
    const res = await GET(new Request("http://localhost/api/foods/search?q=番茄鸡蛋面&meal=lunch&limit=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("番茄鸡蛋面");
    expect(body.meal).toBe("lunch");
    expect(body.items[0].basisAmount).toBe("500");
    const sql = String(queryMock.mock.calls[0][0]);
    // 中文友好评分：字符覆盖率 + 子串命中（不用 similarity，见踩坑 81）
    expect(sql).toContain("regexp_split_to_array");
    expect(sql).toContain("s.score >= 0.5");
    expect(sql).toContain("unnest(fi.aliases)");
    expect(sql).toContain("meal_tags @> ARRAY[$3::text]");
    expect(sql).toContain("LIMIT 5");
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", "番茄鸡蛋面", "lunch"]);
  });

  it("非法 meal 按未指定处理（仍返回结果）", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/foods/search?q=鸡蛋&meal=brunch"));
    expect((await res.json()).meal).toBeNull();
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", "鸡蛋", null]);
  });

  it("limit 缺省 20 / 上限 50", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost/api/foods/search?q=米"));
    expect(String(queryMock.mock.calls[0][0])).toContain("LIMIT 20");
    queryMock.mockClear();
    await GET(new Request("http://localhost/api/foods/search?q=米&limit=9999"));
    expect(String(queryMock.mock.calls[0][0])).toContain("LIMIT 50");
  });

  it("查询出错时返回结构化 500", async () => {
    queryMock.mockRejectedValue(new Error("boom") as never);
    const res = await GET(new Request("http://localhost/api/foods/search?q=米"));
    expect(res.status).toBe(500);
  });
});
