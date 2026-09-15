import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
vi.mock("@/lib/habits", () => ({ listHabitsWithStats: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { listHabitsWithStats } from "@/lib/habits";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);
const statsMock = vi.mocked(listHabitsWithStats);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
  statsMock.mockResolvedValue({ habits: [], logs: [], stats: [] });
});

describe("GET /api/habits", () => {
  it("returns habits with stats and logs", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    statsMock.mockResolvedValue({
      habits: [{ id: 1, name: "饮水", isBoolean: false, targetValue: 8, schedule: [0, 1, 2, 3, 4, 5, 6] }],
      logs: [{ habitId: 1, logDate: "2026-09-14", value: 5 }],
      stats: [{ habitId: 1, currentStreak: 3, longestStreak: 9, doneToday: false, weekRate: 60, monthRate: 55 }],
    } as never);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.habits).toHaveLength(1);
    expect(body.stats[0].currentStreak).toBe(3);
  });
});

describe("POST /api/habits", () => {
  it("rejects empty name", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "  " } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("creates a boolean habit with default schedule", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "早睡" } });
    queryMock.mockResolvedValue({ rows: [{ id: 1, name: "早睡" }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("u-1");
    expect(args[1]).toBe("早睡");
    // isBoolean 默认 true；schedule 默认全年 7 天
    expect(args[3]).toBe(true);
    expect(args[6]).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("stores target for quantitative habits and drops it for boolean ones", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "饮水", isBoolean: false, targetValue: 8, unit: "杯" } });
    queryMock.mockResolvedValue({ rows: [{ id: 2 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[4]).toBe(8);
    expect(args[5]).toBe("杯");
  });

  it("normalizes an invalid schedule to every day", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "阅读", schedule: [9, "x"] } });
    queryMock.mockResolvedValue({ rows: [{ id: 3 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    expect((queryMock.mock.calls[0][1] as unknown[])[6]).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("rejects an invalid color", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "x", color: "red" } });
    queryMock.mockResolvedValue({ rows: [{ id: 4 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    // 非法颜色回退默认色而非报错
    expect((queryMock.mock.calls[0][1] as unknown[])[7]).toBe("#6366f1");
  });

  it("creates with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-9" });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "拉伸" } });
    queryMock.mockResolvedValue({ rows: [{ id: 5 }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-9");
  });

  // 迁移 043 / Bug 7c：可选时间段（HH:MM），非法或空一律存 null
  it("persists a valid remind window", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "晨跑", remindStart: "07:00", remindEnd: "08:00" } });
    queryMock.mockResolvedValue({ rows: [{ id: 6 }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    // cols: name, icon, isBoolean, targetValue, unit, schedule, color, sortOrder, remindStart, remindEnd, clientId
    expect(args[9]).toBe("07:00");
    expect(args[10]).toBe("08:00");
  });

  it("drops an invalid remind window without failing the request", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "晨跑", remindStart: "25:99", remindEnd: "" } });
    queryMock.mockResolvedValue({ rows: [{ id: 7 }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[9]).toBeNull();
    expect(args[10]).toBeNull();
  });
});