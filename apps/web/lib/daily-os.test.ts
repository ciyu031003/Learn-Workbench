import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ scopeWhere: vi.fn() }));
import { pgPool } from "@/lib/db";
import { scopeWhere } from "@/lib/anon";
import { buildDailyOs } from "./daily-os";

const queryMock = vi.mocked(pgPool.query);
const scopeWhereMock = vi.mocked(scopeWhere);

const TODAY = new Date(2026, 8, 14, 10, 0, 0); // 2026-09-14 周一 10:00

interface Handlers {
  tasks?: unknown[];
  focus?: unknown[];
  habits?: unknown[];
  habitLogs?: unknown[];
  workouts?: unknown[];
  meals?: unknown[];
  profile?: unknown[];
  highMatch?: unknown[];
  apps?: unknown[];
  certs?: unknown[];
}

function setup(h: Handlers) {
  queryMock.mockImplementation((sql: string) => {
    const s = String(sql);
    if (s.includes("FROM daily_tasks")) return Promise.resolve({ rows: h.tasks ?? [] } as never);
    if (s.includes("FROM focus_sessions")) return Promise.resolve({ rows: h.focus ?? [] } as never);
    if (s.includes("FROM habits")) return Promise.resolve({ rows: h.habits ?? [] } as never);
    if (s.includes("FROM habit_logs")) return Promise.resolve({ rows: h.habitLogs ?? [] } as never);
    if (s.includes("FROM workouts")) return Promise.resolve({ rows: h.workouts ?? [] } as never);
    if (s.includes("FROM meal_entries")) return Promise.resolve({ rows: h.meals ?? [] } as never);
    if (s.includes("FROM user_settings")) return Promise.resolve({ rows: h.profile ?? [] } as never);
    if (s.includes("FROM agg a")) return Promise.resolve({ rows: h.highMatch ?? [] } as never);
    if (s.includes("FROM job_applications")) return Promise.resolve({ rows: h.apps ?? [] } as never);
    if (s.includes("FROM certificates")) return Promise.resolve({ rows: h.certs ?? [] } as never);
    return Promise.resolve({ rows: [] } as never);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("buildDailyOs", () => {
  it("aggregates all domains for a logged-in user", async () => {
    setup({
      tasks: [
        { id: "1", title: "学 Python", done: true, taskType: "study", careerKey: "ict", focusMinutes: 30 },
        { id: "2", title: "刷题", done: false, taskType: "exam", careerKey: "ict", focusMinutes: 0 },
      ],
      focus: [{ seconds: 3600 }],
      habits: [
        { id: 1, name: "饮水", isBoolean: false, targetValue: "8", schedule: [0, 1, 2, 3, 4, 5, 6] },
        { id: 2, name: "早睡", isBoolean: true, targetValue: null, schedule: [0, 1, 2, 3, 4, 5, 6] },
      ],
      habitLogs: [{ habitId: "1", logDate: "2026-09-14", value: "8" }],
      workouts: [{ name: "胸 + 三头", minutes: "45" }],
      meals: [{ kcal: "1650" }],
      profile: [{ targetRole: "网络安全工程师" }],
      highMatch: [{ n: "12" }],
      apps: [{ n: "3" }],
      certs: [{ n: "1" }],
    });

    const r = await buildDailyOs({ uid: "u-1", anonId: null }, TODAY);
    expect(r.date).toBe("2026-09-14");
    expect(r.greeting).toBe("早上好");
    expect(r.learning.tasksTotal).toBe(2);
    expect(r.learning.tasksDone).toBe(1);
    expect(r.learning.focusMinutes).toBe(60);
    expect(r.habits).toEqual({ scheduled: 2, done: 1 });
    expect(r.fitness.workoutName).toBe("胸 + 三头");
    expect(r.fitness.workoutMinutes).toBe(45);
    expect(r.fitness.nutritionKcal).toBe(1650);
    expect(r.career).toEqual({
      targetRole: "网络安全工程师",
      highMatchJobs: 12,
      pendingApplications: 3,
      expiringCertificates: 1,
    });
    // 任务 1/2 = 0.5*40 + 习惯 1/2 = 0.5*30 + 运动 15 + 饮食 min(1,1650/2000)=0.825*15 ≈ 79
    expect(r.progress).toBe(Math.round(0.5 * 40 + 0.5 * 30 + 15 + (1650 / 2000) * 15));
  });

  it("computes zero progress for an empty day", async () => {
    setup({});
    const r = await buildDailyOs({ uid: "u-1", anonId: null }, TODAY);
    expect(r.progress).toBe(0);
    expect(r.learning.items).toEqual([]);
    expect(r.habits).toEqual({ scheduled: 0, done: 0 });
  });

  it("skips career queries for anonymous scopes", async () => {
    setup({ tasks: [{ id: "1", title: "t", done: true, taskType: "study", careerKey: "ict", focusMinutes: 0 }] });
    const r = await buildDailyOs({ uid: null, anonId: "anon-1" }, TODAY);
    expect(r.career).toEqual({ targetRole: null, highMatchJobs: 0, pendingApplications: 0, expiringCertificates: 0 });
    // 匿名不查询 job_applications / certificates
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("FROM job_applications"))).toBe(false);
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("FROM certificates"))).toBe(false);
  });

  it("caps progress at 100 when everything is done", async () => {
    setup({
      tasks: [{ id: "1", title: "t", done: true, taskType: "study", careerKey: "ict", focusMinutes: 0 }],
      habits: [{ id: 1, name: "早睡", isBoolean: true, targetValue: null, schedule: [0, 1, 2, 3, 4, 5, 6] }],
      habitLogs: [{ habitId: "1", logDate: "2026-09-14", value: "1" }],
      workouts: [{ name: "训练", minutes: "30" }],
      meals: [{ kcal: "3000" }],
    });
    const r = await buildDailyOs({ uid: "u-1", anonId: null }, TODAY);
    expect(r.progress).toBe(100);
  });

  it("greets by hour", async () => {
    setup({});
    expect((await buildDailyOs({ uid: "u-1", anonId: null }, new Date(2026, 8, 14, 2))).greeting).toBe("夜深了");
    expect((await buildDailyOs({ uid: "u-1", anonId: null }, new Date(2026, 8, 14, 12))).greeting).toBe("中午好");
    expect((await buildDailyOs({ uid: "u-1", anonId: null }, new Date(2026, 8, 14, 20))).greeting).toBe("晚上好");
  });

  it("skips the habit-log query when there are no habits", async () => {
    setup({ habits: [] });
    await buildDailyOs({ uid: "u-1", anonId: null }, TODAY);
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("FROM habit_logs"))).toBe(false);
  });

  // v3 M11 深化：今日饮食明细随聚合一起返回（Hub/今日页不必再发一次请求）
  it("returns today's nutrition entries (latest first, capped at 5)", async () => {
    setup({
      meals: [
        { id: "9", name: "桃子", meal: "snack", kcal: "62", createdAt: "2026-09-14T02:17:00.000Z" },
        { id: "8", name: "香煎鳕鱼海鲜烩菜", meal: "dinner", kcal: "520", createdAt: "2026-09-14T02:16:00.000Z" },
        { id: "7", name: "米饭", meal: "lunch", kcal: "230", createdAt: "2026-09-14T02:15:00.000Z" },
        { id: "6", name: "水煮蛋", meal: "breakfast", kcal: "78", createdAt: "2026-09-14T02:14:00.000Z" },
        { id: "5", name: "牛奶", meal: "breakfast", kcal: "120", createdAt: "2026-09-14T02:13:00.000Z" },
        { id: "4", name: "苹果", meal: "snack", kcal: "80", createdAt: "2026-09-14T02:12:00.000Z" },
      ],
    });
    const r = await buildDailyOs({ uid: "u-1", anonId: null }, TODAY);
    expect(r.fitness.nutritionEntries).toHaveLength(5);
    expect(r.fitness.nutritionEntries?.[0]).toEqual({
      id: 9,
      name: "桃子",
      meal: "snack",
      kcal: 62,
      createdAt: "2026-09-14T02:17:00.000Z",
    });
    // 热量合计用的是全部条目（不只是展示的 5 条）
    expect(r.fitness.nutritionKcal).toBe(62 + 520 + 230 + 78 + 120 + 80);
    expect(r.fitness.nutritionRemainingKcal).toBe(2000 - (62 + 520 + 230 + 78 + 120 + 80));
  });

  it("normalises an unknown meal value to snack (不崩、不返回脏枚举)", async () => {
    setup({ meals: [{ id: "1", name: "x", meal: "brunch", kcal: "100", createdAt: "2026-09-14T02:00:00.000Z" }] });
    const r = await buildDailyOs({ uid: "u-1", anonId: null }, TODAY);
    expect(r.fitness.nutritionEntries?.[0].meal).toBe("snack");
  });

  it("hydrates today's water intake from hydration_logs", async () => {
    setup({});
    const r = await buildDailyOs({ uid: "u-1", anonId: null }, TODAY);
    expect(r.hydration).toEqual({ totalMl: 0, targetMl: 2000 });
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("FROM hydration_logs"))).toBe(true);
  });
});