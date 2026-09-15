import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { GET, POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("GET /api/nutrition", () => {
  it("returns entries with totals for a date", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [
        { id: "1", logDate: "2026-09-14", meal: "breakfast", foodId: "3", name: "鸡蛋", amount: "2", unit: "个", kcal: "156", proteinG: "12.6", carbsG: "1.2", fatG: "10.6" },
        { id: "2", logDate: "2026-09-14", meal: "lunch", foodId: null, name: "鸡胸肉", amount: "1", unit: "份", kcal: "165", proteinG: "31", carbsG: "0", fatG: "3.6" },
      ],
    } as never);
    const res = await GET(new Request("http://localhost/api/nutrition?date=2026-09-14"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.totals.kcal).toBe(321);
    expect(body.totals.proteinG).toBe(44); // 12.6 + 31 = 43.6 → 44
  });

  it("falls back to today for an invalid date", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/nutrition?date=bad"));
    const body = await res.json();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // v3 M3：时间线要显示 HH:mm，所以明细必须带 createdAt（ISO）
  it("returns createdAt as ISO for each entry", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "9", logDate: "2026-09-15", meal: "snack", foodId: null, name: "桃子", amount: "1", unit: "个",
          kcal: "62", proteinG: "1", carbsG: "15", fatG: "0.2",
          createdAt: "2026-09-15T10:17:00.000Z",
        },
      ],
    } as never);
    const res = await GET(new Request("http://localhost/api/nutrition?date=2026-09-15"));
    const body = await res.json();
    expect(body.entries[0].createdAt).toBe("2026-09-15T10:17:00.000Z");
    expect(String(queryMock.mock.calls[0][0])).toContain('created_at AS "createdAt"');
  });
});

describe("POST /api/nutrition", () => {
  it("rejects an empty name", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "  " } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("computes nutrition from a saved food", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { meal: "breakfast", name: "鸡蛋", foodId: 3, amount: 2 } });
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "3", unit: "个", kcal: "78", proteinG: "6.3", carbsG: "0.6", fatG: "5.3" }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 1 }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    // args: [uid, date, meal, foodId, name, amount, unit, kcal, protein, carbs, fat, clientId]
    const args = queryMock.mock.calls[1][1] as unknown[];
    // 单位沿用食物单位；营养 × 数量
    expect(args[6]).toBe("个");
    expect(args[7]).toBe(156);
    expect(args[8]).toBe(12.6);
  });

  it("404 when the food cannot be found", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "x", foodId: 999 } });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("accepts manual nutrition values without a food id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "自制沙拉", kcal: 250, proteinG: 12, carbsG: 20, fatG: 9 } });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 2 }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[7]).toBe(250);
    expect(args[8]).toBe(12);
  });

  it("defaults an invalid meal to lunch", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "x", meal: "brunch" } });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 3 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    expect((queryMock.mock.calls[0][1] as unknown[])[2]).toBe("lunch");
  });
});

describe("DELETE /api/nutrition", () => {
  it("soft-deletes an entry", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/nutrition?id=4"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at = now()");
  });

  it("rejects an invalid id", async () => {
    const res = await DELETE(new Request("http://localhost/api/nutrition?id=x"));
    expect(res.status).toBe(400);
  });
});