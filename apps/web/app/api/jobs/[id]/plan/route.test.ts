import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.resetAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/jobs/[id]/plan", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/jobs/1/plan"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(new Request("http://localhost/api/jobs/abc/plan"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("builds a phase-grouped learning plan", async () => {
    // 按 SQL 内容分发 mock（顺序无关，避免 Promise.all 并发时序）
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM job_postings")) {
        return { rows: [{ id: 10, title: "后端工程师", company: "测试公司", city: "成都", salary_text: "15-25K", education: "本科", experience: "1-3年" }] } as never;
      }
      if (sql.includes("FROM job_skill_links")) {
        return { rows: [{ skill_id: 1, name: "redis", weight: 1 }] } as never;
      }
      if (sql.includes("FROM user_skills")) return { rows: [] } as never;
      if (sql.includes("FROM skill_content_links")) {
        return { rows: [{ skill_id: 1, name: "redis", topic_id: 838, topic_title: "Redis", estimate_hours: 8, phase_id: 5, phase_title: "中间件与缓存", phase_key: "phase-5" }] } as never;
      }
      if (sql.includes("FROM content_phases")) return { rows: [{ id: 5, sort_order: 4 }] } as never;
      return { rows: [] } as never;
    });

    const res = await GET(new Request("http://localhost/api/jobs/10/plan"), { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.title).toBe("后端工程师");
    expect(body.match).toBeGreaterThanOrEqual(0);
    expect(body.totalHours).toBe(8);
    expect(body.estimatedWeeks).toBe(1);
    expect(body.phases).toHaveLength(1);
    expect(body.phases[0]).toMatchObject({ phaseId: 5, phaseTitle: "中间件与缓存", sortOrder: 4, hours: 8 });
    expect(body.phases[0].skills[0]).toMatchObject({ skill: "redis", phaseId: 5 });
  });
});
