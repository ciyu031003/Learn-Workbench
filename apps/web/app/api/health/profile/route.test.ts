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

const EMPTY_ROW = {
  weightKg: "60",
  heightCm: null,
  birthYear: null,
  sex: null,
  activityLevel: null,
  bodyGoal: null,
  trainingDaysPerWeek: null,
  sleepTargetMinutes: null,
  bedtimeTarget: null,
  reminderPrefs: {},
};

describe("GET /api/health/profile", () => {
  it("无记录时返回默认目标与默认睡眠设置", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.profile.weightKg).toBe(60);
    expect(body.profile.bodyGoal).toBe("maintain");
    expect(body.profile.sleepTargetMinutes).toBe(450);
    expect(body.profile.bedtimeTarget).toBe("23:30");
    expect(body.profile.reminderPrefs).toEqual({});
    expect(body.plan.kcal).toBe(2000);
    expect(body.plan.computed).toBe(false);
  });

  it("有身体数据时返回 Mifflin-St Jeor 计划", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [{
        weightKg: "70",
        heightCm: 175,
        birthYear: 1996,
        sex: "male",
        activityLevel: "moderate",
        bodyGoal: "lose",
        trainingDaysPerWeek: 4,
        sleepTargetMinutes: 480,
        bedtimeTarget: "22:45",
        reminderPrefs: { earlySleep: true, protein: false, quietStart: "23:00", quietEnd: "07:00" },
      }],
    } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.plan.bmr).toBeGreaterThan(1500);
    expect(body.plan.goal).toBe("lose");
    expect(body.plan.goalDeltaPct).toBe(-15);
    expect(body.plan.proteinPerKg).toBe(2);
    expect(body.profile.sleepTargetMinutes).toBe(480);
    expect(body.profile.reminderPrefs.earlySleep).toBe(true);
  });

  it("非法枚举回落到安全值", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [{ ...EMPTY_ROW, bodyGoal: "bulk", sex: "other", activityLevel: "super", bedtimeTarget: "25:99" }],
    } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.profile.bodyGoal).toBe("maintain");
    expect(body.profile.sex).toBeNull();
    expect(body.profile.activityLevel).toBeNull();
    expect(body.profile.bedtimeTarget).toBe("23:30");
  });
});

describe("PUT /api/health/profile", () => {
  it("只传提醒偏好时不会覆盖已有身体数据", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: { reminderPrefs: { earlySleep: true, protein: true, quietStart: "22:30", quietEnd: "07:00", hack: 1 } },
    });
    queryMock.mockResolvedValue({ rows: [EMPTY_ROW] } as never);

    const res = await PUT(new Request("http://localhost", { method: "PUT" }));
    expect(res.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("reminder_prefs");
    expect(sql).not.toContain("weight_kg");
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("u-1");
    expect(String(args[1])).toBe(JSON.stringify({ earlySleep: true, protein: true, quietStart: "22:30", quietEnd: "07:00" }));
  });

  it("身体数据与目标按列 upsert", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: {
        weightKg: 70,
        heightCm: 175,
        birthYear: 1996,
        sex: "male",
        activityLevel: "moderate",
        bodyGoal: "gain",
        trainingDaysPerWeek: 4,
        sleepTargetMinutes: 480,
        bedtimeTarget: "22:45",
      },
    });
    queryMock.mockResolvedValue({ rows: [EMPTY_ROW] } as never);

    await PUT(new Request("http://localhost", { method: "PUT" }));
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("ON CONFLICT (user_id)");
    expect(sql).toContain("body_goal");
    expect(sql).toContain("training_days_per_week");
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[1]).toBe(70);
    expect(args[2]).toBe(175);
    expect(args[6]).toBe("gain");
    expect(args[7]).toBe(4);
    expect(args[8]).toBe(480);
    expect(args[9]).toBe("22:45");
  });

  it("越界数值钳位，非法枚举写成 null", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: { weightKg: 999, heightCm: 10, bodyGoal: "bulk", trainingDaysPerWeek: 99, sleepTargetMinutes: 10 },
    });
    queryMock.mockResolvedValue({ rows: [EMPTY_ROW] } as never);

    await PUT(new Request("http://localhost", { method: "PUT" }));
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[1]).toBe(300);
    expect(args[2]).toBe(100);
    expect(args[3]).toBeNull();
    expect(args[3]).toBeNull();
    expect(args[4]).toBe(7);
    expect(args[5]).toBe(300);
  });

  it("体重传 null 回落默认 60", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { weightKg: null } });
    queryMock.mockResolvedValue({ rows: [EMPTY_ROW] } as never);
    await PUT(new Request("http://localhost", { method: "PUT" }));
    expect((queryMock.mock.calls[0][1] as unknown[])[1]).toBe(60);
  });

  it("没有可更新字段返回 400", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: {} });
    const res = await PUT(new Request("http://localhost", { method: "PUT" }));
    expect(res.status).toBe(400);
  });

  it("匿名设备走 anon_id 分支", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    parseBodyMock.mockResolvedValue({ ok: true, data: { bodyGoal: "lose" } });
    queryMock.mockResolvedValue({ rows: [EMPTY_ROW] } as never);
    await PUT(new Request("http://localhost", { method: "PUT" }));
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (anon_id)");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-1");
  });
});
