import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/job-clusters", () => ({ jobClusterSources: vi.fn() }));

import { pgPool } from "@/lib/db";
import { jobClusterSources } from "@/lib/job-clusters";
import { jobRowToPosting, queryJobs } from "./queries";

const queryMock = vi.mocked(pgPool.query);
const sourcesMock = vi.mocked(jobClusterSources);
beforeEach(() => vi.resetAllMocks());

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, source: "lagou", source_job_id: "l1", title: "前端工程师", company: "星辰",
    city: "上海", district: "徐汇", salary_min: 15, salary_max: 25, salary_text: "15-25K",
    experience: "1-3年", education: "本科", tags: ["React"], description: "d",
    requirements: "r", company_info: "c", url: "https://x", logo_url: "",
    category: "internet", channel: "job", deadline_at: null, extra: {},
    published_at: null, fetched_at: "2026-08-17T00:00:00Z",
    ...overrides,
  };
}

describe("jobRowToPosting", () => {
  it("maps all snake_case fields to the posting shape", () => {
    const p = jobRowToPosting(row() as never);
    expect(p.id).toBe(1);
    expect(p.source).toBe("lagou");
    expect(p.sourceJobId).toBe("l1");
    expect(p.title).toBe("前端工程师");
    expect(p.salaryMin).toBe(15);
    expect(p.salaryMax).toBe(25);
    expect(p.tags).toEqual(["React"]);
    expect(p.category).toBe("internet");
    expect(p.channel).toBe("job");
    expect(p.deadlineAt).toBeNull();
    expect(p.extra).toEqual({});
  });

  it("applies defaults for category/channel/tags/extra", () => {
    const p = jobRowToPosting(row({ category: "", channel: "announcement", tags: "not-array", extra: null }) as never);
    expect(p.category).toBe("internet");
    expect(p.channel).toBe("announcement");
    expect(p.tags).toEqual([]);
    expect(p.extra).toEqual({});
  });

  it("normalizes an arbitrary channel to job", () => {
    const p = jobRowToPosting(row({ channel: "weird" }) as never);
    expect(p.channel).toBe("job");
  });
});

describe("queryJobs", () => {
  it("applies q/city filters and default new sort without userId", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...row(), is_new: true, is_fav: false }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] } as never);
    const res = await queryJobs({ q: "前端", city: "上海", page: 1, pageSize: 10 });
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0].isNew).toBe(true);
    expect(res.jobs[0].isFav).toBe(false);
    expect(res.total).toBe(1);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("fetched_at DESC, id DESC");
    expect(args).toEqual(["%前端%", "上海", 10, 0]);
  });

  it("builds P1 multi-condition WHERE with sort salary and userId favorites", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...row(), is_new: false, is_fav: true }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] } as never);
    const res = await queryJobs({
      salaryMin: 10, salaryMax: 30, education: ["本科", "硕士"], experience: ["1-3年"],
      publishedWithin: "7d", skills: ["Python"], platforms: ["lagou"], sort: "salary",
      page: 2, pageSize: 10, userId: "u-1",
    });
    expect(res.jobs[0].isFav).toBe(true);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    const s = String(sql);
    expect(s).toContain("COALESCE(salary_min, 0) >= $1");
    expect(s).toContain("education = ANY($3::text[])");
    expect(s).toContain("tags ?| $5::text[]");
    expect(s).toContain("source = ANY($6::text[])");
    expect(s).toContain("salary_max DESC NULLS LAST");
    expect(args).toContain("u-1");
  });

  it("adds the favorites EXISTS when favOnly + userId", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] } as never);
    await queryJobs({ favOnly: true, userId: "u-42", page: 1, pageSize: 5 });
    const [sql] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("job_favorites");
    const [cntSql] = queryMock.mock.calls[1] as unknown[];
    expect(String(cntSql)).toContain("EXISTS (SELECT 1 FROM job_favorites");
  });

  it("does not attach cluster sources when includeSources is false", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...row(), is_new: false, is_fav: false }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] } as never);
    const res = await queryJobs({ page: 1, pageSize: 10 });
    expect((res.jobs[0] as unknown as { clusterSources?: string[] }).clusterSources).toBeUndefined();
    expect(sourcesMock).not.toHaveBeenCalled();
  });

  it("attaches cluster sources when includeSources and a job has >1 sources", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...row(), is_new: false, is_fav: false }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] } as never);
    sourcesMock.mockResolvedValue({ 1: ["lagou", "boss"] });
    const res = await queryJobs({ includeSources: true, page: 1, pageSize: 10 });
    expect((res.jobs[0] as unknown as { clusterSources?: string[] }).clusterSources).toEqual(["lagou", "boss"]);
  });
});


