import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 13, 10, 0, 0)); // 2026-08-13 local
  currentUserIdMock.mockResolvedValue("u-1");
});

afterEach(() => vi.useRealTimers());

describe("GET /api/summary", () => {
  it("computes the dashboard summary from all aggregated queries", async () => {
    const query = vi.fn();
    query.mockImplementation((sql: string) => {
      if (sql.includes("FROM settings")) return Promise.resolve({ rows: [] });
      if (sql.includes("FROM careers")) return Promise.resolve({ rows: [{ name: "ICT 学习规划" }] });
      if (sql.includes("FROM content_topics")) return Promise.resolve({ rows: [
        { id: 1, phase_id: 1 },
        { id: 2, phase_id: 1 },
        { id: 3, phase_id: 2 },
      ] });
      if (sql.includes("AND done = true")) return Promise.resolve({ rows: [{ topic_id: 1 }, { topic_id: 3 }] });
      if (sql.includes("FROM content_phases")) return Promise.resolve({ rows: [
        { id: 1, phase_key: "phase-0", title: "P0", track: "main" },
        { id: 2, phase_key: "phase-1", title: "P1", track: "main" },
      ] });
      if (sql.includes("task_date = $2")) return Promise.resolve({ rows: [
        { id: 5, task_date: "2026-08-13", title: "T", phase_id: 1, topic_id: null, task_type: "study", done: false, focus_minutes: 0, sort_order: 0 },
      ] });
      if (sql.includes("task_date BETWEEN")) return Promise.resolve({ rows: [{ done: true }, { done: false }] });
      if (sql.includes("FROM focus_sessions")) return Promise.resolve({ rows: [{ s: 3600 }] });
      if (sql.includes("FROM checkins")) return Promise.resolve({ rows: [
        { checkin_date: "2026-08-13" },
        { checkin_date: "2026-08-12" },
        { checkin_date: "2026-08-11" },
      ] });
      if (sql.includes("FROM xp_events")) return Promise.resolve({ rows: [{ x: 120 }] });
      if (sql.includes("FROM certificates")) return Promise.resolve({ rows: [
        { id: 1, name: "HCIP-Datacom", target_date: null, status: "planned", note: null },
      ] });
      if (sql.includes("FROM log_entries")) return Promise.resolve({ rows: [{ n: 4 }] });
      return Promise.resolve({ rows: [] });
    });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      career: "ict",
      careerName: "ICT 学习规划",
      overallPercent: 67,
      weekTaskCount: 2,
      weekTaskDone: 1,
      streak: 3,
      totalFocusMinutes: 60,
      xp: 120,
      logsThisWeek: 4,
    });
    expect(json.phases).toEqual([
      { phaseId: 1, phaseKey: "phase-0", title: "P0", track: "main", total: 2, done: 1, percent: 50 },
      { phaseId: 2, phaseKey: "phase-1", title: "P1", track: "main", total: 1, done: 1, percent: 100 },
    ]);
    expect(json.todayTasks).toHaveLength(1);
    expect(json.certificates).toEqual([
      { id: 1, name: "HCIP-Datacom", target_date: null, status: "planned", note: null },
    ]);
    expect(release).toHaveBeenCalled();
  });

  it("uses the saved career for progress scoping", async () => {
    const query = vi.fn();
    query.mockImplementation((sql: string) => {
      if (sql.includes("FROM settings")) return Promise.resolve({ rows: [{ value: "frontend" }] });
      if (sql.includes("FROM careers")) return Promise.resolve({ rows: [{ name: "前端工程师" }] });
      return Promise.resolve({ rows: [] });
    });
    connectMock.mockResolvedValue({ query, release: vi.fn() } as never);
    const json = await (await GET()).json();
    expect(json.career).toBe("frontend");
    expect(json.careerName).toBe("前端工程师");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("career_key = $2"),
      ["u-1", "frontend"]
    );
  });

  it("returns 500 when the database is unavailable", async () => {
    connectMock.mockResolvedValue({
      query: vi.fn().mockRejectedValue(new Error("boom")),
      release: vi.fn(),
    } as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "数据库暂不可用" });
    errSpy.mockRestore();
  });
});
