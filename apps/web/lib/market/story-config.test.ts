import { describe, expect, it } from "vitest";
import { buildMarketStory, buildStoryRanks } from "./story-config";
import type { MarketAnalysis } from "@/lib/domains/market/types";

const data = {
  total: 12,
  overview: {
    total: 12,
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
  ],
  generatedAt: new Date().toISOString(),
} as MarketAnalysis;

describe("buildMarketStory", () => {
  it("builds seven story chapters with talent and learning sections", () => {
    const chapters = buildMarketStory(data);
    expect(chapters).toHaveLength(7);
    expect(chapters[0].id).toBe("cover");
    expect(chapters[1].conclusion).toContain("后端");
    expect(chapters[2].conclusion).toContain("深圳");
    expect(chapters[3]).toMatchObject({ id: "talent", title: "人才画像" });
    expect(chapters[6]).toMatchObject({ id: "learning" });
  });

  it("builds rank data for charts", () => {
    const ranks = buildStoryRanks(data);
    expect(ranks.cities[0]).toMatchObject({ label: "深圳", value: 8 });
    expect(ranks.skills[0]).toMatchObject({ label: "Python", value: 6 });
  });
});
