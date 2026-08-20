import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { analyzeMarket } from "./market";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("analyzeMarket (P4)", () => {
  it("aggregates city/skill/salary/edu/exp from job_postings", async () => {
    queryMock
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
      } as never);                                                                           // exp

    const m = await analyzeMarket();
    expect(m.total).toBe(5);
    expect(m.byCity[0]).toEqual({ city: "深圳", count: 3, avgMin: 15, avgMax: 25 });
    expect(m.bySkill[0]).toEqual({ skill: "Python", count: 3 });
    // 薪资分桶：12k→10-15，18k→15-20，35k→30+，9k→10 以下，22k→20-30
    const s = Object.fromEntries(m.salaryDist.map((x) => [x.label, x.count]));
    expect(s["10K 以下"]).toBe(1);
    expect(s["10-15K"]).toBe(1);
    expect(s["15-20K"]).toBe(1);
    expect(s["20-30K"]).toBe(1);
    expect(s["30K 以上"]).toBe(1);
    // 学历：本科 2 / 硕士 1
    expect(m.byEducation.find((e) => e.label === "本科")?.count).toBe(2);
    expect(m.byEducation.find((e) => e.label === "硕士")?.count).toBe(1);
    // 经验
    expect(m.byExperience.find((e) => e.label === "1-3年")?.count).toBe(1);
    expect(m.byExperience.find((e) => e.label === "应届")?.count).toBe(1);
  });

  it("uses cache on second call", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    await analyzeMarket();
    const calls = queryMock.mock.calls.length;
    await analyzeMarket();
    expect(queryMock.mock.calls.length).toBe(calls); // 第二次走缓存，无新查询
  });
});
