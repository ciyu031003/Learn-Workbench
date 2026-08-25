import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { analyzeMarket } from "./market";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("analyzeMarket (P4)", () => {
  it("aggregates city/skill/salary/edu/exp from job_postings", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)                                          // DB 缓存 miss
      .mockResolvedValueOnce({ rows: [{ n: 5 }] } as never)                                  // total
      .mockResolvedValueOnce({
        rows: [
          { city: "深圳", count: 3, avg_min: 15, avg_max: 25 },
          { city: "上海", count: 2, avg_min: 20, avg_max: 30 },
        ],
      } as never)                                                                            // byCity
      .mockResolvedValueOnce({
        rows: [
          { skill: "Python", count: 3 },
          { skill: "Docker", count: 2 },
        ],
      } as never)                                                                            // bySkill
      .mockResolvedValueOnce({
        rows: [
          { min: 8, max: 12 },
          { min: 12, max: 18 },
          { min: 25, max: 35 },
          { min: 5, max: 9 },
          { min: 16, max: 22 },
        ],
      } as never)                                                                            // salary rows
      .mockResolvedValueOnce({
        rows: [{ education: "本科" }, { education: "硕士" }, { education: "本科" }],
      } as never)                                                                            // edu
      .mockResolvedValueOnce({
        rows: [{ experience: "1-3年" }, { experience: "3-5年" }, { experience: "应届" }],
      } as never)                                                                            // exp
      .mockResolvedValueOnce({
        rows: [
          { title: "Java 后端开发", tags: [] },
          { title: "前端工程师", tags: [] },
          { title: "测试开发工程师", tags: [] },
          { title: "星辰科技有限公司", tags: [] }, // 公司名脏数据 → 不计入职能
          { title: "AI 算法实习生", tags: ["实习"] },
        ],
      } as never)                                                                            // fn/title rows
      .mockResolvedValueOnce({
        rows: [{ source: "zhilian" }, { source: "zhilian" }, { source: "lagou" }, { source: "lagou" }, { source: "job51" }],
      } as never)                                                                            // platform
      .mockResolvedValueOnce({
        rows: [
          { skill: "python", avg: 24, n: 3 },
          { skill: "docker", avg: 28, n: 2 },
        ],
      } as never)                                                                           // skillSalary
      .mockResolvedValueOnce({ rows: [{ n: 2 }] } as never)                                  // cityCount
      .mockResolvedValueOnce({ rows: [{ n: 2 }] } as never)                                  // skillCount
      .mockResolvedValue({ rows: [] } as never);                                                // upsert（默认）

    const m = await analyzeMarket();
    expect(m.total).toBe(5);
    expect(m.overview).toMatchObject({ total: 5, cityCount: 2, skillCount: 2, avgSalary: 19, medianSalary: 18, salaryMin: 9, salaryQ1: 12, salaryQ3: 22, salaryMax: 35 });
    expect(m.byCity[0]).toEqual({ city: "深圳", count: 3, avgMin: 15, avgMax: 25 });
    expect(m.bySkill[0]).toEqual({ skill: "Python", count: 3 });
    const s = Object.fromEntries(m.salaryDist.map((x) => [x.label, x.count]));
    expect(s["10K 以下"]).toBe(1);
    expect(s["10-15K"]).toBe(1);
    expect(s["15-20K"]).toBe(1);
    expect(s["20-30K"]).toBe(1);
    expect(s["30K 以上"]).toBe(1);
    expect(m.byEducation.find((e) => e.label === "本科")?.count).toBe(2);
    expect(m.byEducation.find((e) => e.label === "硕士")?.count).toBe(1);
    expect(m.byExperience.find((e) => e.label === "1-3年")?.count).toBe(1);
    expect(m.byExperience.find((e) => e.label === "应届")?.count).toBe(1);
    expect(m.byFunction.find((f) => f.label === "后端")?.count).toBe(1);
    expect(m.byFunction.find((f) => f.label === "前端")?.count).toBe(1);
    expect(m.byFunction.find((f) => f.label === "测试")?.count).toBe(1);
    expect(m.byFunction.find((f) => f.label === "算法/AI")?.count).toBe(1);
    expect(m.byFunction.reduce((a, f) => a + f.count, 0)).toBe(4); // 公司名不计入
    expect(m.byPlatform.find((p) => p.label === "智联")?.count).toBe(2);
    expect(m.byPlatform.find((p) => p.label === "拉勾")?.count).toBe(2);
    expect(m.byJobType.find((t) => t.label === "全职")?.count).toBe(4);
    expect(m.byJobType.find((t) => t.label === "实习")?.count).toBe(1);
    expect(m.skillSalary[0]).toEqual({ skill: "python", avgSalary: 24, count: 3 });
  });

  it("uses the DB cache on a fresh second call (no recompute)", async () => {
    // 第一次：缓存 miss → 10 次聚合查询
    for (let i = 0; i < 10; i += 1) queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValue({ rows: [] } as never); // 默认：覆盖第一次的 upsert
    await analyzeMarket();
    const callsAfterFirst = queryMock.mock.calls.length;
    // 第二次：缓存命中，只读 market_stats 一次
    queryMock.mockResolvedValueOnce({
      rows: [{
        payload: {
          total: 0, byCity: [], bySkill: [], salaryDist: [], byEducation: [],
          byExperience: [], byFunction: [], byPlatform: [], byJobType: [],
          skillSalary: [], generatedAt: new Date().toISOString(),
        },
        computed_at: new Date(),
      }],
    } as never);
    const m2 = await analyzeMarket();
    expect(queryMock.mock.calls.length).toBe(callsAfterFirst + 1);
    expect(m2.total).toBe(0);
  });
});