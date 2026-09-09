import { describe, expect, it } from "vitest";
import {
  classifyMarketFunction,
  classifyMarketIndustry,
  classifyMarketSalaryBand,
  classifyMarketSeniority,
  enrichMarketJob,
} from "./enrich";

describe("market enrichment rules", () => {
  it("classifies common job functions", () => {
    expect(classifyMarketFunction("Java高级开发工程师")).toBe("后端");
    expect(classifyMarketFunction("前端工程师 React")).toBe("前端");
    expect(classifyMarketFunction("数据分析师")).toBe("数据");
  });

  it("classifies seniority from experience and title", () => {
    expect(classifyMarketSeniority("Java开发", "3-5年")).toBe("3-5年");
    expect(classifyMarketSeniority("前端实习生", "")).toBe("应届/实习");
    expect(classifyMarketSeniority("资深架构师", "")).toBe("5-10年");
  });

  it("assigns deterministic industry buckets", () => {
    expect(classifyMarketIndustry("AI算法工程师", ["python", "pytorch"])).toEqual({
      industrySector: "科技",
      industrySubsector: "数据与 AI",
    });
    expect(classifyMarketIndustry("金融风控分析师", [])).toEqual({
      industrySector: "金融",
      industrySubsector: "金融科技",
    });
  });

  it("maps salary to configured band", () => {
    expect(classifyMarketSalaryBand(null, 2200)).toBe("20-30K");
    expect(classifyMarketSalaryBand(null, null)).toBe("未披露");
  });

  it("returns full enrichment fields", () => {
    expect(
      enrichMarketJob({
        title: "Python后端工程师",
        experience: "1-3年",
        salaryMax: 1800,
        tags: ["python", "fastapi"],
      })
    ).toEqual(expect.objectContaining({
      functionKey: "后端",
      seniorityBucket: "1-3年",
      salaryBand: "15-20K",
    }));
  });
});
