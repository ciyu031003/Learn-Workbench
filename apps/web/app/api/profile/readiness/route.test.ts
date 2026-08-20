import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

afterEach(() => vi.useRealTimers());

describe("GET /api/profile/readiness", () => {
  it("computes four-dimension readiness from existing tables", async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("FROM settings")) return Promise.resolve({ rows: [{ value: "frontend" }] } as never);
      if (sql.includes("FROM careers")) return Promise.resolve({ rows: [{ name: "前端工程师" }] } as never);
      if (sql.includes("kind = 'skill'")) return Promise.resolve({ rows: [{ n: 3 }] } as never);
      if (sql.includes("FROM topic_progress")) return Promise.resolve({ rows: [{ done: 5, total: 10 }] } as never);
      if (sql.includes("kind = 'project'")) return Promise.resolve({ rows: [{ n: 2 }] } as never);
      if (sql.includes("SELECT DISTINCT kind")) return Promise.resolve({ rows: [
        { kind: "skill" }, { kind: "project" }, { kind: "github" }, { kind: "certificate" },
      ] } as never);
      if (sql.includes("kind = 'interview'")) return Promise.resolve({ rows: [{ n: 2 }] } as never);
      if (sql.includes("FROM job_postings")) return Promise.resolve({ rows: [{ n: 88 }] } as never);
      return Promise.resolve({ rows: [] } as never);
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.targetRole).toBe("前端工程师");
    expect(json.dimensions).toHaveLength(4);
    expect(json.dimensions[0].key).toBe("skill");
    expect(json.dimensions[0].score).toBeGreaterThan(0);
    expect(json.dimensions[1].key).toBe("project");
    expect(json.dimensions[2].key).toBe("resume");
    expect(json.dimensions[2].score).toBe(100); // 四类资产齐全
    expect(json.dimensions[3].key).toBe("interview");
    expect(json.overall).toBeGreaterThan(0);
    expect(json.matchedJobs).toBe(88);
  });

  it("handles anonymous local mode (userId null)", async () => {
    currentUserIdMock.mockResolvedValue(null);
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("FROM careers")) return Promise.resolve({ rows: [{ name: "ICT 学习规划" }] } as never);
      return Promise.resolve({ rows: [] } as never);
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.targetRole).toBe("ICT 学习规划");
    expect(json.overall).toBe(0);
  });

  it("returns 500 when the database is unavailable", async () => {
    queryMock.mockRejectedValue(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "数据库暂不可用" });
    errSpy.mockRestore();
  });
});
