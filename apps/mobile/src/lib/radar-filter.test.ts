import { describe, it, expect } from "vitest";
import {
  applyRadarFilter,
  filterRadar,
  radarCategoryOf,
  radarFacets,
  sortRadar,
  EMPTY_RADAR_FILTER,
} from "./radar-filter";

interface TestJob {
  jobId: number;
  title: string;
  company: string;
  city: string;
  overall: number;
  gapHours: number;
  functionKey: string;
  industrySector: string;
}

const job = (over: Partial<TestJob> = {}): TestJob => ({
  jobId: 1,
  title: "后端开发工程师",
  company: "某公司",
  city: "北京",
  overall: 80,
  gapHours: 4,
  functionKey: "backend",
  industrySector: "互联网",
  ...over,
});

describe("radarCategoryOf", () => {
  it("识别互联网公司", () => {
    expect(radarCategoryOf(job({ company: "字节跳动" }))).toBe("internet");
    expect(radarCategoryOf(job({ company: "某某科技", industrySector: "软件服务" }))).toBe("internet");
  });
  it("识别考公考编", () => {
    expect(radarCategoryOf(job({ title: "事业单位综合管理岗", company: "某市人社局" }))).toBe("civil");
    expect(radarCategoryOf(job({ title: "省考公务员" }))).toBe("civil");
  });
  it("识别国企央企", () => {
    expect(radarCategoryOf(job({ company: "国家电网某省公司" }))).toBe("state");
    expect(radarCategoryOf(job({ company: "某国企" }))).toBe("state");
  });
  it("其余归 other", () => {
    expect(radarCategoryOf(job({ company: "小饭馆", industrySector: "餐饮", title: "厨师" }))).toBe("other");
  });
  it("考公优先于互联网（避免「互联网+事业单位」误判）", () => {
    expect(radarCategoryOf(job({ title: "事业单位信息中心", industrySector: "互联网" }))).toBe("civil");
  });
});

describe("filterRadar / sortRadar", () => {
  const jobs = [
    job({ jobId: 1, city: "北京", overall: 90 }),
    job({ jobId: 2, city: "上海", overall: 60 }),
    job({ jobId: 3, city: "北京", overall: 70, company: "国家电网" }),
  ];

  it("按城市筛选", () => {
    expect(filterRadar(jobs, { ...EMPTY_RADAR_FILTER, city: "北京" }).map((j) => j.jobId)).toEqual([1, 3]);
  });

  it("按类别筛选", () => {
    expect(filterRadar(jobs, { ...EMPTY_RADAR_FILTER, category: "state" }).map((j) => j.jobId)).toEqual([3]);
    expect(filterRadar(jobs, { ...EMPTY_RADAR_FILTER, category: "all" })).toHaveLength(3);
  });

  it("按岗位方向筛选", () => {
    const mixed = [job({ jobId: 1, functionKey: "backend" }), job({ jobId: 2, functionKey: "frontend" })];
    expect(filterRadar(mixed, { ...EMPTY_RADAR_FILTER, functionKey: "frontend" }).map((j) => j.jobId)).toEqual([2]);
  });

  it("匹配度高→低 / 低→高", () => {
    expect(sortRadar(jobs, "match_desc").map((j) => j.jobId)).toEqual([1, 3, 2]);
    expect(sortRadar(jobs, "match_asc").map((j) => j.jobId)).toEqual([2, 3, 1]);
  });

  it("组合筛选不修改原数组", () => {
    const before = jobs.map((j) => j.jobId);
    const out = applyRadarFilter(jobs, { ...EMPTY_RADAR_FILTER, city: "北京" }, "match_asc");
    expect(out.map((j) => j.jobId)).toEqual([3, 1]);
    expect(jobs.map((j) => j.jobId)).toEqual(before);
  });
});

describe("radarFacets", () => {
  it("去重并按中文排序", () => {
    const f = radarFacets([
      job({ city: "上海", functionKey: "backend" }),
      job({ city: "北京", functionKey: "frontend" }),
      job({ city: "北京", functionKey: "backend" }),
      job({ city: "", functionKey: "" }),
    ]);
    expect(f.cities).toEqual(["北京", "上海"]);
    expect(f.functions).toEqual(["backend", "frontend"]);
  });
});
