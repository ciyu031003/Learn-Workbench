import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/readiness", () => ({ computeReadiness: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { computeReadiness } from "@/lib/readiness";
import { GET } from "./route";

const connectMock = vi.mocked(pgPool.connect);
const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);
const computeReadinessMock = vi.mocked(computeReadiness);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 13, 10, 0, 0)); // 2026-08-13 local
  currentUserIdMock.mockResolvedValue("u-1");
  computeReadinessMock.mockResolvedValue({
    targetRole: "ICT 学习规划",
    overall: 50,
    dimensions: [],
    matchedJobs: 88,
  } as never);
});

afterEach(() => vi.useRealTimers());

describe("GET /api/dashboard", () => {
  it("aggregates summary + readiness + jobs total in one request", async () => {
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
      if (sql.includes("FROM certificates")) return Promise.resolve({ rows: [] });
      if (sql.includes("FROM log_entries")) return Promise.resolve({ rows: [{ n: 4 }] });
      if (sql.includes("FROM job_postings")) return Promise.resolve({ rows: [{ n: 88 }] });
      return Promise.resolve({ rows: [] });
    });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary.overallPercent).toBe(67);
    expect(json.summary.streak).toBe(3);
    expect(json.readiness).toEqual({
      targetRole: "ICT 学习规划",
      overall: 50,
      dimensions: [],
      matchedJobs: 88,
    });
    expect(json.jobsTotal).toBe(88);
    expect(release).toHaveBeenCalled();
    expect(computeReadinessMock).toHaveBeenCalledWith("u-1", null);
  });

  it("returns 500 when the database is unavailable", async () => {
    connectMock.mockRejectedValue(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "数据库暂不可用" });
    errSpy.mockRestore();
  });
});
