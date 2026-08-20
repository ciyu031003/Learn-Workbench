import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { addApplication, listApplications, updateApplicationStage, applicationStats } from "./job-applications";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("listApplications (P3)", () => {
  it("returns joined applications with job snapshot", async () => {
    queryMock.mockResolvedValue({
      rows: [{
        id: 1, job_id: 500, stage: "applied", note: "", applied_at: "2026-08-20T00:00:00Z",
        updated_at: "2026-08-20T00:00:00Z", job_title: "Python 后端", job_company: "星辰科技",
        job_city: "深圳", job_salary: "18-25K", job_url: "https://x", job_source: "boss",
      }],
    } as never);
    const apps = await listApplications("u-1");
    expect(apps).toHaveLength(1);
    expect(apps[0].jobTitle).toBe("Python 后端");
    expect(apps[0].stage).toBe("applied");
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1"]);
  });
});

describe("addApplication (P3)", () => {
  it("upserts and returns application with job snapshot", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 1, job_id: 500, stage: "favorite", note: "", applied_at: null, updated_at: "2026-08-20T00:00:00Z" }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ job_title: "Python 后端", job_company: "星辰科技", job_city: "深圳", job_salary: "18-25K", job_url: "https://x", job_source: "boss" }],
      } as never);
    const app = await addApplication("u-1", 500, "favorite");
    expect(app.jobId).toBe(500);
    expect(app.stage).toBe("favorite");
    const insert = queryMock.mock.calls[0][0] as string;
    expect(insert).toContain("INSERT INTO job_applications");
  });

  it("sets applied_at for active stages", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 1, job_id: 500, stage: "applied", note: "", applied_at: "2026-08-20T00:00:00Z", updated_at: "2026-08-20T00:00:00Z" }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    await addApplication("u-1", 500, "applied");
    const sql = queryMock.mock.calls[0][0] as string;
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toContain("applied_at");
    expect(params[2]).toBe("applied");
  });
});

describe("updateApplicationStage (P3)", () => {
  it("updates stage with correct param numbering", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 1, job_id: 500, stage: "interview1", note: "", applied_at: null, updated_at: "2026-08-20T00:00:00Z" }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const app = await updateApplicationStage("u-1", 1, "interview1", "约了周三面试");
    expect(app).not.toBeNull();
    const sql = queryMock.mock.calls[0][0] as string;
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toContain("stage = $1");
    expect(sql).toContain("note = $2");
    expect(params).toEqual(["interview1", "约了周三面试", 1, "u-1"]);
    expect(sql).toContain("WHERE id = $3 AND user_id = $4");
  });
});

describe("applicationStats (P3)", () => {
  it("zero-fills all stages and counts rows", async () => {
    queryMock.mockResolvedValue({
      rows: [{ stage: "applied", n: 3 }, { stage: "offer", n: 1 }],
    } as never);
    const stats = await applicationStats("u-1");
    expect(stats.applied).toBe(3);
    expect(stats.offer).toBe(1);
    expect(stats.favorite).toBe(0);
    expect(stats.hired).toBe(0);
  });
});
