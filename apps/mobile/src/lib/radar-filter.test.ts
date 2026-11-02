import { describe, it, expect } from "vitest";
import {
  applyRadarFilter,
  buildRadarOverview,
  EMPTY_RADAR_FILTER,
  filterRadar,
  isEmptyRadarFilter,
  matchesSalaryBand,
  normalizeCityName,
  parseSalaryBand,
  provinceOfCity,
  radarActiveFilterCount,
  radarCategoryOf,
  radarDirectionLabel,
  radarFacets,
  citiesForProvinces,
  clearRadarFilterKey,
  radarFilterChips,
  radarProvinceFacets,
  radarUpdatedLabel,
  removeRadarFilterChip,
  toggleRadarFilterValue,
  RADAR_SORT_LABELS,
  radarVisibleSlice,
  sortRadar,
  type RadarFilter,
  type RadarJobLike,
} from "./radar-filter";

interface TestJob extends RadarJobLike {
  jobId: number;
}

const job = (over: Partial<TestJob> = {}): TestJob => ({
  jobId: 1,
  title: "后端开发工程师",
  company: "某公司",
  city: "北京",
  education: "本科",
  experience: "3-5年",
  salaryBand: "20-30K",
  salaryText: "20-30K·14薪",
  source: "boss",
  publishedAt: "2026-10-30T08:00:00.000Z",
  functionKey: "backend",
  industrySector: "互联网",
  overall: 80,
  gapHours: 4,
  ...over,
});

const filter = (over: Partial<RadarFilter> = {}): RadarFilter => ({ ...EMPTY_RADAR_FILTER, ...over });

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
  it("考公优先于互联网（避免「互联网+事业单位」误判）", () => {
    expect(radarCategoryOf(job({ title: "事业单位信息中心", industrySector: "互联网" }))).toBe("civil");
  });
  it("其余归 other", () => {
    expect(radarCategoryOf(job({ company: "小饭馆", industrySector: "餐饮", title: "厨师" }))).toBe("other");
  });
});

describe("省市二级", () => {
  it("城市名归一：去掉市/地区等后缀", () => {
    expect(normalizeCityName("北京市")).toBe("北京");
    expect(normalizeCityName("深圳市")).toBe("深圳");
    expect(normalizeCityName(" 杭州 ")).toBe("杭州");
    expect(normalizeCityName("")).toBe("");
  });

  it("城市归到省，未收录/空城市落「其他」", () => {
    expect(provinceOfCity("北京")).toBe("北京");
    expect(provinceOfCity("深圳市")).toBe("广东");
    expect(provinceOfCity("杭州")).toBe("浙江");
    expect(provinceOfCity("苏州")).toBe("江苏");
    expect(provinceOfCity("某某县")).toBe("其他");
    expect(provinceOfCity("")).toBe("其他");
  });

  it("省分面按岗位数降序，且带城市明细", () => {
    const facets = radarProvinceFacets([
      job({ jobId: 1, city: "深圳" }),
      job({ jobId: 2, city: "广州" }),
      job({ jobId: 3, city: "深圳" }),
      job({ jobId: 4, city: "杭州" }),
      job({ jobId: 5, city: "" }),
    ]);
    expect(facets[0]).toMatchObject({ province: "广东", count: 3 });
    expect(facets[0].cities[0]).toEqual({ city: "深圳", count: 2 });
    expect(facets.find((f) => f.province === "浙江")).toMatchObject({ count: 1 });
  });
});

describe("薪资档位", () => {
  it("解析区间 / 开区间 / 面议", () => {
    expect(parseSalaryBand("20-30K")).toEqual({ min: 20, max: 30 });
    expect(parseSalaryBand("30K+")).toEqual({ min: 30, max: null });
    expect(parseSalaryBand("50K 以上")).toEqual({ min: 50, max: null });
    expect(parseSalaryBand("面议")).toBeNull();
    expect(parseSalaryBand("")).toBeNull();
  });

  it("按区间重叠匹配；未选=全部命中；面议在筛选时排除", () => {
    expect(matchesSalaryBand("20-30K", [])).toBe(true);
    expect(matchesSalaryBand("20-30K", ["20-30"])).toBe(true);
    expect(matchesSalaryBand("20-30K", ["10-20"])).toBe(false);
    expect(matchesSalaryBand("30-50K", ["30up"])).toBe(true);
    expect(matchesSalaryBand("面议", ["30up"])).toBe(false);
    expect(matchesSalaryBand("面议", [])).toBe(true);
  });
});

describe("filterRadar 多条件", () => {
  const jobs = [
    job({ jobId: 1, city: "深圳", salaryBand: "30-50K", education: "本科", source: "boss" }),
    job({ jobId: 2, city: "广州", salaryBand: "10-20K", education: "硕士", company: "国家电网", source: "国聘" }),
    job({ jobId: 3, city: "北京市", salaryBand: "20-30K", education: "本科", source: "boss", experience: "1-3年" }),
  ];

  it("空筛选返回全部", () => {
    expect(filterRadar(jobs, EMPTY_RADAR_FILTER)).toHaveLength(3);
  });

  it("省 / 市筛选（城市名归一后比较）", () => {
    expect(filterRadar(jobs, filter({ provinces: ["广东"] })).map((j) => j.jobId)).toEqual([1, 2]);
    expect(filterRadar(jobs, filter({ cities: ["北京"] })).map((j) => j.jobId)).toEqual([3]);
  });

  it("方向 / 学历 / 来源 / 薪资多选", () => {
    expect(filterRadar(jobs, filter({ categories: ["state"] })).map((j) => j.jobId)).toEqual([2]);
    expect(filterRadar(jobs, filter({ educations: ["硕士"] })).map((j) => j.jobId)).toEqual([2]);
    expect(filterRadar(jobs, filter({ sources: ["boss"] })).map((j) => j.jobId)).toEqual([1, 3]);
    expect(filterRadar(jobs, filter({ salaryBands: ["30up"] })).map((j) => j.jobId)).toEqual([1]);
    expect(filterRadar(jobs, filter({ salaryBands: ["10-20", "20-30"] })).map((j) => j.jobId)).toEqual([2, 3]);
  });

  it("经验筛选（数据里有经验才生效）", () => {
    expect(filterRadar(jobs, filter({ experiences: ["1-3年"] })).map((j) => j.jobId)).toEqual([3]);
  });

  it("职能 / 行业筛选", () => {
    expect(filterRadar(jobs, filter({ functions: ["backend"] }))).toHaveLength(3);
    expect(filterRadar(jobs, filter({ functions: ["frontend"] }))).toHaveLength(0);
    expect(filterRadar(jobs, filter({ industries: ["互联网"] }))).toHaveLength(3);
  });

  it("多条件取交集", () => {
    const out = filterRadar(jobs, filter({ provinces: ["广东"], educations: ["硕士"] }));
    expect(out.map((j) => j.jobId)).toEqual([2]);
  });
});

describe("sortRadar", () => {
  const jobs = [
    job({ jobId: 1, overall: 90, publishedAt: "2026-10-01T00:00:00.000Z", salaryBand: "10-20K" }),
    job({ jobId: 2, overall: 70, publishedAt: "2026-10-31T00:00:00.000Z", salaryBand: "30-50K" }),
    job({ jobId: 3, overall: 80, publishedAt: null, salaryBand: "面议" }),
  ];

  it("匹配度降序，同分看缺口小时", () => {
    expect(sortRadar(jobs, "match_desc").map((j) => j.jobId)).toEqual([1, 3, 2]);
    const tie = [job({ jobId: 1, overall: 80, gapHours: 8 }), job({ jobId: 2, overall: 80, gapHours: 2 })];
    expect(sortRadar(tie, "match_desc").map((j) => j.jobId)).toEqual([2, 1]);
  });

  it("最新优先，未知发布时间排最后", () => {
    expect(sortRadar(jobs, "latest").map((j) => j.jobId)).toEqual([2, 1, 3]);
  });

  it("薪资优先，面议排最后", () => {
    expect(sortRadar(jobs, "salary_desc").map((j) => j.jobId)).toEqual([2, 1, 3]);
  });

  it("排序不修改原数组", () => {
    const before = jobs.map((j) => j.jobId);
    sortRadar(jobs, "latest");
    expect(jobs.map((j) => j.jobId)).toEqual(before);
  });
});

describe("applyRadarFilter / 已选计数", () => {
  const jobs = [job({ jobId: 1, city: "深圳" }), job({ jobId: 2, city: "北京", overall: 60 })];

  it("组合筛选 + 排序不修改原数组", () => {
    const before = jobs.map((j) => j.jobId);
    const out = applyRadarFilter(jobs, filter({ provinces: ["广东"] }), "match_desc");
    expect(out.map((j) => j.jobId)).toEqual([1]);
    expect(jobs.map((j) => j.jobId)).toEqual(before);
  });

  it("已选条件计数按数组项累加", () => {
    expect(isEmptyRadarFilter(EMPTY_RADAR_FILTER)).toBe(true);
    expect(radarActiveFilterCount(filter({ provinces: ["广东", "北京"], salaryBands: ["30up"] }))).toBe(3);
  });
});

describe("radarFacets", () => {
  it("城市 / 方向 / 学历 / 来源 / 薪资分面带计数并降序", () => {
    const facets = radarFacets([
      job({ jobId: 1, city: "深圳", education: "本科", source: "boss", functionKey: "backend" }),
      job({ jobId: 2, city: "深圳", education: "硕士", source: "boss", functionKey: "frontend" }),
      job({ jobId: 3, city: "北京", education: "本科", source: "国聘", functionKey: "backend" }),
    ]);
    expect(facets.provinces[0].province).toBe("广东");
    expect(facets.categories.find((c) => c.key === "internet")?.count).toBe(3);
    expect(facets.functions[0]).toMatchObject({ key: "backend", count: 2 });
    expect(facets.educations.find((e) => e.key === "本科")?.count).toBe(2);
    expect(facets.sources.find((s) => s.key === "boss")?.count).toBe(2);
    expect(facets.salaryBands.length).toBeGreaterThan(0);
  });

  it("没有经验字段时经验分面为空（筛选入口自动隐藏）", () => {
    const facets = radarFacets([job({ experience: undefined })]);
    expect(facets.experiences).toEqual([]);
  });
});

describe("buildRadarOverview", () => {
  const now = Date.parse("2026-11-01T12:00:00.000Z");
  const jobs = [
    job({ jobId: 1, city: "深圳", publishedAt: "2026-11-01T10:00:00.000Z" }),
    job({ jobId: 2, city: "深圳", publishedAt: "2026-10-31T10:00:00.000Z" }),
    job({ jobId: 3, city: "北京", company: "国家电网", publishedAt: "2026-10-01T10:00:00.000Z" }),
  ];

  it("统计匹配总数 / 城市 Top3 / 方向 Top3 / 更新时间", () => {
    const overview = buildRadarOverview(jobs, {
      total: 42,
      counts: { candidates: 128, matched: 42, favorites: 3, applications: 1 },
      now,
    });
    expect(overview).toMatchObject({ matchedTotal: 42, scanned: 128, favoriteCount: 3, applicationCount: 1 });
    expect(overview.topCities[0]).toEqual({ city: "深圳", count: 2 });
    expect(overview.topCategories[0]).toMatchObject({ category: "internet", label: "互联网", count: 2 });
    expect(overview.updatedAt).toBe("2026-11-01T10:00:00.000Z");
    expect(overview.updatedLabel).toBe("2 小时前更新");
  });

  it("空候选集给出 0 与「时间未知」", () => {
    const overview = buildRadarOverview([], { now });
    expect(overview.matchedTotal).toBe(0);
    expect(overview.updatedAt).toBeNull();
    expect(overview.updatedLabel).toBe("时间未知");
  });
});

describe("radarUpdatedLabel", () => {
  const now = Date.parse("2026-11-01T12:00:00.000Z");
  it("按时间差给出相对文案", () => {
    expect(radarUpdatedLabel("2026-11-01T11:59:40.000Z", now)).toBe("刚刚更新");
    expect(radarUpdatedLabel("2026-11-01T11:30:00.000Z", now)).toBe("30 分钟前更新");
    expect(radarUpdatedLabel("2026-11-01T02:00:00.000Z", now)).toBe("10 小时前更新");
    expect(radarUpdatedLabel("2026-10-31T02:00:00.000Z", now)).toBe("昨天更新");
    expect(radarUpdatedLabel("2026-10-28T02:00:00.000Z", now)).toBe("4 天前更新");
    expect(radarUpdatedLabel("2026-10-01T02:00:00.000Z", now)).toBe("10 月 1 日更新");
    expect(radarUpdatedLabel(null, now)).toBe("时间未知");
  });
});

describe("radarVisibleSlice", () => {
  const list = Array.from({ length: 25 }, (_, index) => index + 1);

  it("首屏 10 条、还有更多", () => {
    const slice = radarVisibleSlice(list, 10);
    expect(slice.items).toHaveLength(10);
    expect(slice).toMatchObject({ shown: 10, total: 25, hasMore: true, nextSize: 20 });
  });

  it("加载更多到最后一页不再 hasMore", () => {
    expect(radarVisibleSlice(list, 20).nextSize).toBe(25);
    const last = radarVisibleSlice(list, 25);
    expect(last.hasMore).toBe(false);
    expect(last.shown).toBe(25);
  });

  it("size 不合法时回落到一页", () => {
    expect(radarVisibleSlice(list, Number.NaN).items).toHaveLength(10);
    expect(radarVisibleSlice(list, 0).items).toHaveLength(10);
    expect(radarVisibleSlice(list, 999).items).toHaveLength(25);
  });
});

describe("radarDirectionLabel / 排序文案", () => {
  it("方向文案优先级：职能 > 行业 > 领域", () => {
    expect(radarDirectionLabel(job({ functionKey: "backend", industrySector: "互联网" }))).toBe("backend");
    expect(radarDirectionLabel(job({ functionKey: "", industrySector: "互联网" }))).toBe("互联网");
    expect(radarDirectionLabel(job({ functionKey: "", industrySector: "", company: "小饭馆", title: "厨师" }))).toBe("其它");
  });

  it("三种排序都有中文标签", () => {
    expect(RADAR_SORT_LABELS).toEqual({ match_desc: "匹配度", latest: "最新", salary_desc: "薪资" });
  });
});
describe("筛选值增删（弹层 / 已选胶囊）", () => {
  it("toggle 多选值：选中 ↔ 取消，不改原对象", () => {
    const base = filter();
    const added = toggleRadarFilterValue(base, "provinces", "广东");
    expect(added.provinces).toEqual(["广东"]);
    expect(base.provinces).toEqual([]);
    expect(toggleRadarFilterValue(added, "provinces", "广东").provinces).toEqual([]);
  });

  it("categories 与 salaryBands 走同一个 toggle 入口", () => {
    const withCategory = toggleRadarFilterValue(filter(), "categories", "internet");
    expect(withCategory.categories).toEqual(["internet"]);
    expect(radarFilterChips(withCategory)[0]).toMatchObject({ group: "categories", value: "internet", label: "互联网" });
    const withSalary = toggleRadarFilterValue(filter(), "salaryBands", "30up");
    expect(radarFilterChips(withSalary)[0]).toMatchObject({ label: "30K 以上" });
  });

  it("清空单一维度", () => {
    const base = filter({ provinces: ["广东", "北京"], educations: ["本科"] });
    const cleared = clearRadarFilterKey(base, "provinces");
    expect(cleared.provinces).toEqual([]);
    expect(cleared.educations).toEqual(["本科"]);
  });

  it("已选胶囊按固定维度顺序展开，并可逐项删除", () => {
    const base = filter({ cities: ["深圳"], provinces: ["广东"], educations: ["本科"] });
    const chips = radarFilterChips(base);
    expect(chips.map((c) => c.group)).toEqual(["provinces", "cities", "educations"]);
    const afterRemove = removeRadarFilterChip(base, chips[0]);
    expect(afterRemove.provinces).toEqual([]);
    expect(afterRemove.cities).toEqual(["深圳"]);
  });

  it("省份选择联动城市候选", () => {
    const all = ["深圳", "广州", "北京", "杭州"];
    expect(citiesForProvinces([], all)).toEqual(all);
    expect(citiesForProvinces(["广东"], all)).toEqual(["深圳", "广州"]);
    expect(citiesForProvinces(["北京", "浙江"], all)).toEqual(["北京", "杭州"]);
  });
});
describe("整条筛选流水线（屏幕层组合口径）", () => {
  const batchJobs = [
    job({ jobId: 1, city: "深圳", overall: 92, salaryBand: "30-50K", publishedAt: "2026-10-31T00:00:00.000Z", source: "boss" }),
    job({ jobId: 2, city: "广州", overall: 81, salaryBand: "20-30K", publishedAt: "2026-10-30T00:00:00.000Z", source: "boss" }),
    job({ jobId: 3, city: "北京", overall: 76, salaryBand: "10-20K", publishedAt: "2026-11-01T00:00:00.000Z", source: "国聘" }),
    job({ jobId: 4, city: "杭州", overall: 64, salaryBand: "20-30K", publishedAt: "2026-10-25T00:00:00.000Z", source: "拉勾" }),
    job({ jobId: 5, city: "深圳", overall: 58, salaryBand: "10-20K", publishedAt: "2026-10-20T00:00:00.000Z", source: "拉勾" }),
    job({ jobId: 6, city: "上海", overall: 51, salaryBand: "面议", publishedAt: null, source: "boss" }),
    job({ jobId: 7, city: "广州", overall: 90, salaryBand: "30-50K", publishedAt: "2026-10-29T00:00:00.000Z", source: "拉勾" }),
  ];

  it("默认：匹配度排序 + 首屏 10 条（不足 10 条即全量）", () => {
    const filtered = applyRadarFilter(batchJobs, EMPTY_RADAR_FILTER, "match_desc");
    expect(filtered.map((j) => j.jobId)).toEqual([1, 7, 2, 3, 4, 5, 6]);
    const slice = radarVisibleSlice(filtered, 10);
    expect(slice.shown).toBe(7);
    expect(slice.hasMore).toBe(false);
  });

  it("筛选广东 + 薪资 20-30K：结果、概览与分页口径一致", () => {
    const nextFilter = filter({ provinces: ["广东"], salaryBands: ["20-30"] });
    const filtered = applyRadarFilter(batchJobs, nextFilter, "match_desc");
    expect(filtered.map((j) => j.jobId)).toEqual([2]);
    const overview = buildRadarOverview(batchJobs, { total: 42 });
    // 深圳/广州 各 2 个：同数按中文排序，广州在前
    expect(overview.topCities[0]).toEqual({ city: "广州", count: 2 });
  });

  it("回退模式（overall 0、无技能）也能排序/分面，不崩", () => {
    const fallback = [
      job({ jobId: 1, overall: 0, experience: undefined, salaryBand: "", publishedAt: "2026-10-01T00:00:00.000Z" }),
      job({ jobId: 2, overall: 0, experience: undefined, salaryBand: "", publishedAt: null }),
    ];
    const facets = radarFacets(fallback);
    expect(facets.experiences).toEqual([]);
    expect(facets.salaryBands).toEqual([]);
    expect(sortRadar(fallback, "latest").map((j) => j.jobId)).toEqual([1, 2]);
    expect(radarDirectionLabel(fallback[0])).toBe("backend");
  });
});
