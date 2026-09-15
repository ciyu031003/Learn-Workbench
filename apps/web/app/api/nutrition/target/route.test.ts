import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { GET, PUT } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("GET /api/nutrition/target", () => {
  it("无身体数据 → 用默认目标且 computed=false", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ weightKg: "62", heightCm: null, birthYear: null, sex: null, activityLevel: null, targetKcal: null, proteinG: null, carbsG: null, fatG: null }] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.target.kcal).toBe(2000);
    expect(body.target.computed).toBe(false);
    expect(body.target.note).toContain("填身高");
  });

  it("有身体数据 → BMR × 活动系数（男 30 岁 175cm 70kg 中等活动）", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [{ weightKg: "70", heightCm: 175, birthYear: 1996, sex: "male", activityLevel: "moderate", targetKcal: null, proteinG: null, carbsG: null, fatG: null }],
    } as never);
    const res = await GET();
    const body = await res.json();
    // BMR = 10*70 + 6.25*175 - 5*age + 5 ≈ 1649（age 取决于当前年份）
    expect(body.target.computed).toBe(true);
    expect(body.target.bmr).toBeGreaterThan(1500);
    expect(body.target.bmr).toBeLessThan(1750);
    expect(body.target.factor).toBe(1.55);
    expect(body.target.kcal).toBe(Math.round(body.target.bmr * 1.55));
    expect(body.target.note).toContain("BMR");
  });

  it("手动覆盖优先于自动计算", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [{ weightKg: "70", heightCm: 175, birthYear: 1996, sex: "male", activityLevel: "moderate", targetKcal: "2400", proteinG: null, carbsG: null, fatG: null }],
    } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.target.kcal).toBe(2400);
    // 三大营养素按 2400 kcal 与 70kg 推
    expect(body.target.proteinG).toBe(Math.round(1.6 * 70));
    expect(body.target.fatG).toBe(Math.round(0.9 * 70));
  });
});

describe("PUT /api/nutrition/target", () => {
  it("写入身体数据并按 user_id upsert", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: { weightKg: 70, heightCm: 175, birthYear: 1996, sex: "male", activityLevel: "light" },
    });
    queryMock.mockResolvedValue({ rows: [] } as never);

    const res = await PUT(new Request("http://localhost", { method: "PUT" }));
    expect(res.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("ON CONFLICT (user_id)");
    expect(sql).toContain("height_cm");
    expect(sql).toContain("activity_level");
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("u-1");
    // values: weight_kg, height_cm, birth_year, sex, activity_level
    expect(args[1]).toBe(70);
    expect(args[2]).toBe(175);
    expect(args[3]).toBe(1996);
    expect(args[4]).toBe("male");
    expect(args[5]).toBe("light");
  });

  it("非法枚举与越界值被丢弃（不写入脏数据）", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: { weightKg: 999, heightCm: 10, sex: "other", activityLevel: "super" },
    });
    queryMock.mockResolvedValue({ rows: [] } as never);

    await PUT(new Request("http://localhost", { method: "PUT" }));
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[1]).toBe(300); // 钳位到上限
    expect(args[2]).toBe(100); // 钳位到下限
    expect(args[3]).toBeNull();
    expect(args[4]).toBeNull();
    expect(args[5]).toBeNull();
  });

  it("匿名设备走 anon_id 分支", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    parseBodyMock.mockResolvedValue({ ok: true, data: { weightKg: 60 } });
    queryMock.mockResolvedValue({ rows: [] } as never);

    await PUT(new Request("http://localhost", { method: "PUT" }));
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (anon_id)");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-1");
  });

  it("解析失败返回 400", async () => {
    parseBodyMock.mockResolvedValue({ ok: false, status: 413, error: "too large" });
    const res = await PUT(new Request("http://localhost", { method: "PUT" }));
    expect(res.status).toBe(413);
  });
});
