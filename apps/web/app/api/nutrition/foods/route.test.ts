import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const parseBodyMock = vi.mocked(parseBody);

beforeEach(() => {
  vi.resetAllMocks();
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("GET /api/nutrition/foods", () => {
  it("returns global and user foods, filtered by q", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 3, name: "鸡蛋", unit: "个", kcal: 78 }] } as never);
    const res = await GET(new Request("http://localhost/api/nutrition/foods?q=鸡"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.foods).toHaveLength(1);
    // params: [uid, '%鸡%']
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", "%鸡%"]);
  });

  it("lists without a query filter", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost/api/nutrition/foods"));
    expect(queryMock.mock.calls[0][1]).toEqual([null]);
  });

  // v3 M4/M9：按最近使用排序（一点即记 / 贴纸墙的数据源）
  it("sorts by recent usage when sort=recent", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [{ id: 3, name: "鸡蛋", unit: "个", kcal: 78, times: 9, lastUsed: "2026-09-15T00:00:00.000Z" }],
    } as never);
    const res = await GET(new Request("http://localhost/api/nutrition/foods?sort=recent&limit=12"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sort).toBe("recent");
    expect(body.foods[0].times).toBe(9);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("meal_entries");
    expect(sql).toContain("ORDER BY COALESCE(u.times, 0) DESC");
    expect(sql).toContain("LIMIT 12");
    // 搜索词仍然生效
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1"]);
  });

  it("recent + q 同时生效，limit 被钳位", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost/api/nutrition/foods?sort=recent&q=鸡&limit=9999"));
    expect(String(queryMock.mock.calls[0][0])).toContain("LIMIT 200");
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", "%鸡%"]);
  });
});

describe("POST /api/nutrition/foods", () => {
  it("requires login", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects an empty name", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("upserts a user food", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "自制沙拉", unit: "份", kcal: 250, proteinG: 12, carbsG: 20, fatG: 9 } });
    queryMock.mockResolvedValue({ rows: [{ id: 9 }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", "自制沙拉", "份", 250, 12, 20, 9]);
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (user_id, lower(name))");
  });
});