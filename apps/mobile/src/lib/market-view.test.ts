import { describe, expect, it } from "vitest";
import { marketKpis, marketSkillRows } from "./market-view";
import type { MarketAnalysis } from "@learn-workbench/shared";

const market = {
  total: 20,
  overview: {
    total: 20,
    cityCount: 2,
    skillCount: 3,
    avgSalary: 18,
    medianSalary: 16,
    salaryMin: 6,
    salaryQ1: 12,
    salaryQ3: 24,
    salaryMax: 34,
  },
  trend: {
    has: false,
    prevDate: null,
    totalDeltaPct: null,
    topSkill: null,
    topSkillCount: null,
    topSkillDelta: null,
    topCity: null,
    topCityCount: null,
    topCityDelta: null,
    avgSalaryDelta: null,
  },
  byCity: [
    { city: "深圳", count: 8, avgMin: 16, avgMax: 30 },
    { city: "成都", count: 4, avgMin: 12, avgMax: 22 },
  ],
  bySkill: [
    { skill: "Python", count: 6 },
    { skill: "Linux", count: 4 },
  ],
  salaryDist: [
    { label: "10-20K", min: 10, count: 7 },
    { label: "20-30K", min: 20, count: 5 },
  ],
  byEducation: [{ label: "本科", count: 8 }],
  byExperience: [{ label: "3-5年", count: 6 }],
  byFunction: [{ label: "后端", count: 7 }, { label: "数据", count: 5 }],
  byPlatform: [{ label: "Boss", count: 8 }],
  byJobType: [{ label: "全职", count: 11 }],
  skillSalary: [
    { skill: "Python", avgSalary: 24, count: 6 },
    { skill: "Linux", avgSalary: 18, count: 4 },
    { skill: "SQL", avgSalary: null, count: 2 },
  ],
  generatedAt: new Date().toISOString(),
} as unknown as MarketAnalysis;

describe("market view models", () => {
  it("derives real KPI values from market data", () => {
    expect(marketKpis(market)).toEqual({
      total: 20,
      cityCount: 2,
      skillCount: 3,
      avgSalary: 18,
    });
  });

  it("merges user levels and gaps while dropping incomplete salary rows", () => {
    const rows = marketSkillRows(
      market,
      [{ id: 1, name: "python", category: "dev", level: 3, source: "manual" }],
      [
        {
          skillId: 1,
          skill: "Linux",
          category: "dev",
          jobCount: 4,
          demandWeight: 4,
          myLevel: 0,
          missing: true,
          topicId: 9,
          topicTitle: "Linux 基础",
          estimateHours: 6,
          enrollable: true,
          phaseId: 3,
          phaseTitle: null,
          phaseKey: null,
        },
      ]
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ skill: "Python", count: 6, avgSalary: 24, myLevel: 3 });
    expect(rows[1]).toMatchObject({ skill: "Linux", topicId: 9, enrollable: true });
  });
});
