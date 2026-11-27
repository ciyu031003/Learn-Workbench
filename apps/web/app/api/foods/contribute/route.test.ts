import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);

function json(body: unknown) {
  return new Request("http://localhost/api/foods/contribute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "  自制燕麦酸奶  ",
  unit: "份",
  kcal: 220,
  proteinG: 12,
  carbsG: 28,
  fatG: 6,
  meal: "breakfast",
};

beforeEach(() => {
  vi.resetAllMocks();
  userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
});

describe("POST /api/foods/contribute（手动食材沉淀公共库）", () => {
  it("名称/营养值非法时返回 400，不查库", async () => {
    const res = await POST(json({ name: "   ", kcal: 220 }));
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
    const badKcal = await POST(json({ ...validBody, kcal: -1 }));
    expect(badKcal.status).toBe(400);
  });

  it("同名已存在时返回已有条目，created=false", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 7,
          name: "自制燕麦酸奶",
          category: "用户添加",
          mealTags: ["breakfast"],
          basisAmount: "1",
          basisUnit: "份",
          kcal: "220",
          proteinG: "12",
          carbsG: "28",
          fatG: "6",
          source: "builtin",
          license: "own",
        },
      ],
    } as never);
    const res = await POST(json(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(false);
    expect(body.item.id).toBe(7);
    expect(body.item.kcal).toBe(220);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toEqual(["自制燕麦酸奶"]);
  });

  it("新名称写入公共库，返回 201 与归一化数值", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 99,
            name: "自制燕麦酸奶",
            category: "用户添加",
            mealTags: ["breakfast"],
            basisAmount: "1",
            basisUnit: "份",
            kcal: "220",
            proteinG: "12",
            carbsG: "28",
            fatG: "6",
            source: "user",
            license: "user-contributed",
          },
        ],
      } as never);
    const res = await POST(json(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toBe(true);
    expect(body.item.source).toBe("user");
    expect(body.item.basisAmount).toBe(1);
    const sql = String(queryMock.mock.calls[1][0]);
    expect(sql).toContain("ON CONFLICT DO NOTHING");
    expect(queryMock.mock.calls[1][1]).toEqual([
      "自制燕麦酸奶",
      ["breakfast"],
      "份",
      220,
      12,
      28,
      6,
      "u-1",
      null,
    ]);
  });

  it("并发写入撞唯一索引时回读赢家，返回 200 created=false", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 100,
            name: "自制燕麦酸奶",
            category: "用户添加",
            mealTags: [],
            basisAmount: "1",
            basisUnit: "份",
            kcal: "220",
            proteinG: "0",
            carbsG: "0",
            fatG: "0",
            source: "user",
            license: "user-contributed",
          },
        ],
      } as never);
    const res = await POST(json(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(false);
    expect(body.item.id).toBe(100);
  });

  it("查询出错时返回结构化 500", async () => {
    queryMock.mockRejectedValue(new Error("boom") as never);
    const res = await POST(json(validBody));
    expect(res.status).toBe(500);
  });
});
