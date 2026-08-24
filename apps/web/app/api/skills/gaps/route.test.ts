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

describe("GET /api/skills/gaps", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/skills/gaps"));
    expect(res.status).toBe(401);
  });

  it("returns aggregated market gaps for the user", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { skill_id: 1, name: "redis", category: "backend", job_count: "42", demand_weight: "42" },
          { skill_id: 2, name: "docker", category: "ops", job_count: "30", demand_weight: "30" },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [{ n: "200" }] } as never)
      .mockResolvedValueOnce({ rows: [{ skill_id: 1, level: 3 }] } as never) // user covers redis
      .mockResolvedValueOnce({
        rows: [{ topic_id: 403, topic_title: "批量运维工具", estimate_hours: 8 }],
      } as never); // learning suggestion for docker
    const res = await GET(new Request("http://localhost/api/skills/gaps?limit=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalJobs).toBe(200);
    expect(body.gaps).toHaveLength(1);
    expect(body.gaps[0]).toMatchObject({
      skill: "docker",
      jobCount: 30,
      myLevel: 0,
      missing: true,
      topicTitle: "批量运维工具",
      estimateHours: 8,
      enrollable: true,
    });
    expect(body.generatedAt).toBeTruthy();
  });

  it("returns 500 on db failure", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    const res = await GET(new Request("http://localhost/api/skills/gaps"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("市场需求缺口分析失败");
  });
});
