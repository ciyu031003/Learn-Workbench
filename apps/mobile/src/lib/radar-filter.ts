/**
 * 就业雷达的**纯筛选 / 排序 / 分面 / 概览逻辑**（零 react-native import → 可单测）。
 *
 * v1.61（P13 精细化）：雷达从「一条永远往下滑的列表」升级为
 *   概览统计 + 多条件底部弹层（省市二级 / 方向职能 / 薪资 / 经验 / 学历 / 来源）
 *   + 匹配度·最新·薪资三种排序 + 加载更多分页。
 * 所有规则都收敛在这里，屏幕组件只渲染结果；这样筛选/排序/分面能直接单测，
 * 也避免"UI 一改口径就漂移"。
 */

export interface RadarJobLike {
  title: string;
  company: string;
  city: string;
  /** 学历要求（接口里的 education） */
  education?: string;
  /** 经验要求；Web 雷达接口当前未下发该字段，缺失时相关筛选自动隐藏 */
  experience?: string;
  /** 薪资档位（如 "20-30K" / "30K+" / "面议"） */
  salaryBand?: string;
  /** 薪资原文（如 "20-30K·14薪"） */
  salaryText?: string;
  /** 来源平台（如 boss / 拉勾 / 国聘） */
  source?: string;
  /** 发布时间（ISO 字符串；null = 未知） */
  publishedAt?: string | null;
  /** 岗位方向（function_key） */
  functionKey?: string;
  /** 行业（industry_sector） */
  industrySector?: string;
  overall: number;
  gapHours?: number;
}

/* ------------------------------------------------------------------ */
/* 领域（方向大类）                                                     */
/* ------------------------------------------------------------------ */

export type RadarCategory = "all" | "internet" | "civil" | "state" | "other";

export const RADAR_CATEGORY_LABELS: Record<RadarCategory, string> = {
  all: "全部",
  internet: "互联网",
  civil: "考公考编",
  state: "国企央企",
  other: "其它",
};

export const RADAR_CATEGORY_ORDER: RadarCategory[] = ["all", "internet", "civil", "state", "other"];

/** 知名互联网/科技公司（按公司名命中） */
const INTERNET_COMPANIES = [
  "字节", "抖音", "腾讯", "阿里", "蚂蚁", "美团", "京东", "百度", "网易", "快手",
  "拼多多", "滴滴", "小红书", "哔哩", "B站", "知乎", "微博", "携程", "去哪儿", "华为",
  "小米", "OPPO", "vivo", "荣耀", "商汤", "旷视", "科大讯飞", "菜鸟", "贝壳", "58同城",
  "360", "搜狐", "新浪", "金山", "用友", "金蝶", "中兴", "海康", "大疆", "米哈游",
  "莉莉丝", "完美世界", "巨人", "三七", "货拉拉", "满帮", "得物", "Shopee", "TikTok", "微软", "谷歌",
];

/** 互联网行业特征词 */
const INTERNET_KEYWORDS = [
  "互联网", "软件", "电商", "游戏", "云计算", "人工智能", "大数据", "信息技术", "网络科技", "客户端", "服务端", "算法工程",
];

/** 考公考编特征词（公务员 / 事业单位 / 编制） */
const CIVIL_KEYWORDS = [
  "公务员", "事业单位", "事业编", "编制", "选调", "教师招聘", "教师编", "人事考试", "人才引进", "三支一扶", "选聘", "公考", "省考", "国考",
];

/** 国企央企特征词 */
const STATE_KEYWORDS = [
  "国企", "央企", "国有", "国家电网", "中国移动", "中国电信", "中国联通", "中石油", "中石化",
  "中建", "中铁", "中核", "航天", "烟草", "国家能源", "中国银行", "工商银行", "建设银行", "农业银行",
];

export function radarCategoryOf(job: RadarJobLike): RadarCategory {
  const text = [job.title, job.company, job.industrySector, job.functionKey].filter(Boolean).join(" ");
  if (CIVIL_KEYWORDS.some((k) => text.includes(k))) return "civil";
  if (STATE_KEYWORDS.some((k) => text.includes(k))) return "state";
  if (INTERNET_COMPANIES.some((k) => job.company.includes(k))) return "internet";
  if (INTERNET_KEYWORDS.some((k) => text.includes(k))) return "internet";
  return "other";
}

/* ------------------------------------------------------------------ */
/* 省市二级                                                             */
/* ------------------------------------------------------------------ */

export interface RadarProvinceCities {
  province: string;
  cities: string[];
}

/**
 * 省 → 常见招聘城市（不需要覆盖全国县城：只用来把接口给的 city 归到省级，
 * 未收录的城市一律落到「其他」并在筛选项里仍可单独选中）。
 */
export const RADAR_PROVINCES: readonly RadarProvinceCities[] = [
  { province: "北京", cities: ["北京"] },
  { province: "上海", cities: ["上海"] },
  { province: "天津", cities: ["天津"] },
  { province: "重庆", cities: ["重庆"] },
  { province: "广东", cities: ["广州", "深圳", "珠海", "东莞", "佛山", "惠州", "中山", "汕头", "江门"] },
  { province: "浙江", cities: ["杭州", "宁波", "温州", "嘉兴", "绍兴", "金华", "湖州"] },
  { province: "江苏", cities: ["南京", "苏州", "无锡", "常州", "南通", "徐州", "扬州"] },
  { province: "四川", cities: ["成都", "绵阳", "德阳"] },
  { province: "湖北", cities: ["武汉", "宜昌", "襄阳"] },
  { province: "湖南", cities: ["长沙", "株洲", "湘潭"] },
  { province: "陕西", cities: ["西安", "咸阳"] },
  { province: "河南", cities: ["郑州", "洛阳"] },
  { province: "山东", cities: ["济南", "青岛", "烟台", "潍坊", "淄博"] },
  { province: "福建", cities: ["福州", "厦门", "泉州"] },
  { province: "安徽", cities: ["合肥", "芜湖"] },
  { province: "江西", cities: ["南昌", "赣州"] },
  { province: "辽宁", cities: ["沈阳", "大连"] },
  { province: "吉林", cities: ["长春"] },
  { province: "黑龙江", cities: ["哈尔滨", "大庆"] },
  { province: "河北", cities: ["石家庄", "保定", "唐山", "廊坊"] },
  { province: "山西", cities: ["太原"] },
  { province: "内蒙古", cities: ["呼和浩特", "包头"] },
  { province: "广西", cities: ["南宁", "桂林", "柳州"] },
  { province: "云南", cities: ["昆明"] },
  { province: "贵州", cities: ["贵阳"] },
  { province: "甘肃", cities: ["兰州"] },
  { province: "海南", cities: ["海口", "三亚"] },
  { province: "新疆", cities: ["乌鲁木齐"] },
  { province: "宁夏", cities: ["银川"] },
  { province: "青海", cities: ["西宁"] },
  { province: "西藏", cities: ["拉萨"] },
  { province: "香港", cities: ["香港"] },
  { province: "澳门", cities: ["澳门"] },
  { province: "台湾", cities: ["台北", "高雄"] },
];

/** 城市名归一：去「市/地区/自治州/盟/特别行政区」等后缀，去掉空白 */
export function normalizeCityName(city: string): string {
  const raw = String(city ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/\s+/g, "")
    .replace(/(特别行政区|自治州|地区|新区|市|盟)$/u, "");
}

const CITY_TO_PROVINCE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const item of RADAR_PROVINCES) {
    for (const city of item.cities) map.set(city, item.province);
  }
  return map;
})();

/** 城市 → 省（未收录返回「其他」；空城市返回「其他」） */
export function provinceOfCity(city: string): string {
  const normalized = normalizeCityName(city);
  if (!normalized) return "其他";
  return CITY_TO_PROVINCE.get(normalized) ?? "其他";
}

export interface RadarProvinceFacet {
  province: string;
  count: number;
  /** 该省在候选集里出现过的城市（按岗位数降序） */
  cities: { city: string; count: number }[];
}

/** 省分面：仅保留候选集里出现过的省与城市，按岗位数降序 */
export function radarProvinceFacets(jobs: readonly RadarJobLike[]): RadarProvinceFacet[] {
  const cityCount = new Map<string, number>();
  for (const job of jobs) {
    const city = normalizeCityName(job.city);
    if (!city) continue;
    cityCount.set(city, (cityCount.get(city) ?? 0) + 1);
  }
  const byProvince = new Map<string, { city: string; count: number }[]>();
  for (const [city, count] of cityCount) {
    const province = provinceOfCity(city);
    const list = byProvince.get(province) ?? [];
    list.push({ city, count });
    byProvince.set(province, list);
  }
  return [...byProvince.entries()]
    .map(([province, cities]) => ({
      province,
      count: cities.reduce((sum, item) => sum + item.count, 0),
      cities: [...cities].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "zh")),
    }))
    .sort((a, b) => b.count - a.count || a.province.localeCompare(b.province, "zh"));
}

/* ------------------------------------------------------------------ */
/* 薪资区间                                                             */
/* ------------------------------------------------------------------ */

export interface RadarSalaryOption {
  key: string;
  label: string;
  min: number | null;
  max: number | null;
}

/** 薪资筛选档位（单位 K/月；min/max 任一为 null 表示该侧不限） */
export const RADAR_SALARY_OPTIONS: readonly RadarSalaryOption[] = [
  { key: "lt10", label: "10K 以下", min: null, max: 10 },
  { key: "10-20", label: "10-20K", min: 10, max: 20 },
  { key: "20-30", label: "20-30K", min: 20, max: 30 },
  { key: "30up", label: "30K 以上", min: 30, max: null },
];

/** 解析接口给的薪资档位文本（"20-30K" / "30K+" / "50K以上" / "面议"） */
export function parseSalaryBand(band: string | undefined | null): { min: number | null; max: number | null } | null {
  const raw = String(band ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;
  const numbers = [...raw.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return null;
  const hasPlus = /\+|以上|起|\+/.test(raw);
  if (numbers.length === 1) {
    return hasPlus ? { min: numbers[0], max: null } : { min: numbers[0], max: numbers[0] };
  }
  const min = Math.min(numbers[0], numbers[1]);
  const max = Math.max(numbers[0], numbers[1]);
  return { min, max: hasPlus ? null : max };
}

/** 薪资档位是否命中任一所选区间（按区间重叠判断；未选 = 全部命中） */
export function matchesSalaryBand(band: string | undefined | null, selectedKeys: readonly string[]): boolean {
  if (selectedKeys.length === 0) return true;
  const parsed = parseSalaryBand(band);
  if (!parsed) return false;
  const bandMin = parsed.min ?? 0;
  const bandMax = parsed.max ?? Number.POSITIVE_INFINITY;
  // 单点档位（如 "25K"）按 [25, 25.001) 处理，避免与相邻区间两侧都不相交而漏筛
  const effectiveBandMax = bandMax > bandMin ? bandMax : bandMin + 0.001;
  return selectedKeys.some((key) => {
    const option = RADAR_SALARY_OPTIONS.find((item) => item.key === key);
    if (!option) return false;
    const optionMin = option.min ?? 0;
    const optionMax = option.max ?? Number.POSITIVE_INFINITY;
    return bandMin < optionMax && effectiveBandMax > optionMin;
  });
}

/* ------------------------------------------------------------------ */
/* 筛选状态                                                             */
/* ------------------------------------------------------------------ */

export interface RadarFilter {
  /** 省级多选（空 = 不限） */
  provinces: string[];
  /** 市级多选（存归一化后的城市名；空 = 不限） */
  cities: string[];
  /** 方向大类（互联网 / 考公考编 / 国企央企 / 其它）多选 */
  categories: RadarCategory[];
  /** 职能（function_key）多选 */
  functions: string[];
  /** 行业（industry_sector）多选 */
  industries: string[];
  /** 薪资区间 key 多选 */
  salaryBands: string[];
  /** 学历多选 */
  educations: string[];
  /** 经验多选（接口没有该字段时选项为空，筛选自动隐藏） */
  experiences: string[];
  /** 来源多选 */
  sources: string[];
}

export const EMPTY_RADAR_FILTER: RadarFilter = {
  provinces: [],
  cities: [],
  categories: [],
  functions: [],
  industries: [],
  salaryBands: [],
  educations: [],
  experiences: [],
  sources: [],
};

/** 已选条件总数（弹层按钮上的角标；数组每项算 1 个） */
export function radarActiveFilterCount(filter: RadarFilter): number {
  return (
    filter.provinces.length +
    filter.cities.length +
    filter.categories.length +
    filter.functions.length +
    filter.industries.length +
    filter.salaryBands.length +
    filter.educations.length +
    filter.experiences.length +
    filter.sources.length
  );
}

export function isEmptyRadarFilter(filter: RadarFilter): boolean {
  return radarActiveFilterCount(filter) === 0;
}

function includesAny(values: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return values.some((value) => selected.includes(value));
}

export function filterRadar<T extends RadarJobLike>(jobs: readonly T[], filter: RadarFilter): T[] {
  return jobs.filter((job) => {
    const city = normalizeCityName(job.city);
    const province = provinceOfCity(job.city);
    if (filter.provinces.length > 0 && !filter.provinces.includes(province)) return false;
    if (filter.cities.length > 0 && !filter.cities.includes(city)) return false;
    if (filter.categories.length > 0 && !filter.categories.includes(radarCategoryOf(job))) return false;
    if (!includesAny([String(job.functionKey ?? "").trim()].filter(Boolean), filter.functions)) return false;
    if (!includesAny([String(job.industrySector ?? "").trim()].filter(Boolean), filter.industries)) return false;
    if (!includesAny([String(job.education ?? "").trim()].filter(Boolean), filter.educations)) return false;
    if (!includesAny([String(job.experience ?? "").trim()].filter(Boolean), filter.experiences)) return false;
    if (!includesAny([String(job.source ?? "").trim()].filter(Boolean), filter.sources)) return false;
    if (!matchesSalaryBand(job.salaryBand, filter.salaryBands)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* 排序                                                                 */
/* ------------------------------------------------------------------ */

export type RadarSort = "match_desc" | "latest" | "salary_desc";

export const RADAR_SORT_LABELS: Record<RadarSort, string> = {
  match_desc: "匹配度",
  latest: "最新",
  salary_desc: "薪资",
};

export const RADAR_SORT_ORDER: readonly RadarSort[] = ["match_desc", "latest", "salary_desc"];

function publishedValue(job: RadarJobLike): number {
  const parsed = Date.parse(String(job.publishedAt ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function salaryValue(job: RadarJobLike): number {
  const parsed = parseSalaryBand(job.salaryBand);
  if (!parsed) return -1;
  return parsed.max ?? parsed.min ?? -1;
}

export function sortRadar<T extends RadarJobLike>(jobs: readonly T[], sort: RadarSort): T[] {
  const list = [...jobs];
  if (sort === "latest") {
    return list.sort(
      (a, b) => publishedValue(b) - publishedValue(a) || b.overall - a.overall || (a.gapHours ?? 0) - (b.gapHours ?? 0),
    );
  }
  if (sort === "salary_desc") {
    return list.sort(
      (a, b) => salaryValue(b) - salaryValue(a) || b.overall - a.overall || (a.gapHours ?? 0) - (b.gapHours ?? 0),
    );
  }
  return list.sort((a, b) => b.overall - a.overall || (a.gapHours ?? 0) - (b.gapHours ?? 0));
}

/** 组合：筛选 + 排序 */
export function applyRadarFilter<T extends RadarJobLike>(jobs: readonly T[], filter: RadarFilter, sort: RadarSort): T[] {
  return sortRadar(filterRadar(jobs, filter), sort);
}

/* ------------------------------------------------------------------ */
/* 分面（弹层里的可选项）                                               */
/* ------------------------------------------------------------------ */

export interface RadarValueFacet {
  key: string;
  label: string;
  count: number;
}

export interface RadarFacets {
  provinces: RadarProvinceFacet[];
  categories: RadarValueFacet[];
  functions: RadarValueFacet[];
  industries: RadarValueFacet[];
  educations: RadarValueFacet[];
  experiences: RadarValueFacet[];
  sources: RadarValueFacet[];
  salaryBands: RadarValueFacet[];
}

function valueFacets(jobs: readonly RadarJobLike[], read: (job: RadarJobLike) => string): RadarValueFacet[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = String(read(job) ?? "").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "zh"));
}

export function radarFacets(jobs: readonly RadarJobLike[]): RadarFacets {
  const categoryCounts = new Map<RadarCategory, number>();
  for (const job of jobs) {
    const category = radarCategoryOf(job);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const categories: RadarValueFacet[] = RADAR_CATEGORY_ORDER.filter((category) => category !== "all")
    .map((category) => ({
      key: category,
      label: RADAR_CATEGORY_LABELS[category],
      count: categoryCounts.get(category) ?? 0,
    }))
    .filter((facet) => facet.count > 0);

  const salaryBands: RadarValueFacet[] = RADAR_SALARY_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    count: jobs.filter((job) => matchesSalaryBand(job.salaryBand, [option.key])).length,
  })).filter((facet) => facet.count > 0);

  return {
    provinces: radarProvinceFacets(jobs),
    categories,
    functions: valueFacets(jobs, (job) => job.functionKey ?? ""),
    industries: valueFacets(jobs, (job) => job.industrySector ?? ""),
    educations: valueFacets(jobs, (job) => job.education ?? ""),
    experiences: valueFacets(jobs, (job) => job.experience ?? ""),
    sources: valueFacets(jobs, (job) => job.source ?? ""),
    salaryBands,
  };
}

/* ------------------------------------------------------------------ */
/* 雷达概览                                                             */
/* ------------------------------------------------------------------ */

export interface RadarOverviewCounts {
  candidates?: number;
  matched?: number;
  favorites?: number;
  applications?: number;
}

export interface RadarOverview {
  /** 匹配岗位总数（接口 total，缺省用候选集长度） */
  matchedTotal: number;
  /** 已扫描候选岗位数（接口 counts.candidates） */
  scanned: number;
  favoriteCount: number;
  applicationCount: number;
  /** 城市分布 Top3 */
  topCities: { city: string; count: number }[];
  /** 方向分布 Top3 */
  topCategories: { category: RadarCategory; label: string; count: number }[];
  /** 最近更新时间（候选集里最新 publishedAt） */
  updatedAt: string | null;
  updatedLabel: string;
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / N 天前 / M月D日 */
export function radarUpdatedLabel(iso: string | null | undefined, now: number = Date.now()): string {
  const time = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(time)) return "时间未知";
  const diff = Math.max(0, now - time);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚更新";
  if (diff < hour) return Math.floor(diff / minute) + " 分钟前更新";
  if (diff < day) return Math.floor(diff / hour) + " 小时前更新";
  if (diff < 2 * day) return "昨天更新";
  if (diff < 7 * day) return Math.floor(diff / day) + " 天前更新";
  const date = new Date(time);
  return date.getMonth() + 1 + " 月 " + date.getDate() + " 日更新";
}

export function buildRadarOverview(
  jobs: readonly RadarJobLike[],
  options: { total?: number; counts?: RadarOverviewCounts; now?: number } = {},
): RadarOverview {
  const now = options.now ?? Date.now();
  const cityCounts = new Map<string, number>();
  const categoryCounts = new Map<RadarCategory, number>();
  let latest = 0;
  for (const job of jobs) {
    const city = normalizeCityName(job.city);
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    const category = radarCategoryOf(job);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    const published = publishedValue(job);
    if (published > latest) latest = published;
  }
  const topCities = [...cityCounts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "zh"))
    .slice(0, 3);
  const topCategories = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, label: RADAR_CATEGORY_LABELS[category], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const matchedTotal = typeof options.total === "number" && options.total > 0 ? options.total : jobs.length;
  const updatedAt = latest > 0 ? new Date(latest).toISOString() : null;
  return {
    matchedTotal,
    scanned: Math.max(options.counts?.candidates ?? 0, jobs.length),
    favoriteCount: options.counts?.favorites ?? 0,
    applicationCount: options.counts?.applications ?? 0,
    topCities,
    topCategories,
    updatedAt,
    updatedLabel: radarUpdatedLabel(updatedAt, now),
  };
}

/* ------------------------------------------------------------------ */
/* 分页（加载更多）                                                     */
/* ------------------------------------------------------------------ */

export const RADAR_PAGE_SIZE = 10;

export interface RadarVisibleSlice<T> {
  items: T[];
  /** 已展示条数（0 基转成"已显示多少条"） */
  shown: number;
  total: number;
  hasMore: boolean;
  /** 下一页要展开到的条数 */
  nextSize: number;
}

/** 计算「已展开 size 条」时的可见列表与加载更多状态 */
export function radarVisibleSlice<T>(jobs: readonly T[], size: number, pageSize: number = RADAR_PAGE_SIZE): RadarVisibleSlice<T> {
  const total = jobs.length;
  const safeSize = Math.max(pageSize, Math.min(total, Math.floor(Number(size) || pageSize)));
  const items = jobs.slice(0, safeSize);
  return {
    items,
    shown: items.length,
    total,
    hasMore: items.length < total,
    nextSize: Math.min(total, safeSize + pageSize),
  };
}

/** 卡片上的「方向」文案：优先职能，其次行业，最后落到领域大类 */
export function radarDirectionLabel(job: RadarJobLike): string {
  const fn = String(job.functionKey ?? "").trim();
  if (fn) return fn;
  const industry = String(job.industrySector ?? "").trim();
  if (industry) return industry;
  return RADAR_CATEGORY_LABELS[radarCategoryOf(job)];
}
/* ------------------------------------------------------------------ */
/* 筛选值的增删（弹层与"已选条件"胶囊共用）                              */
/* ------------------------------------------------------------------ */

export type RadarFilterKey =
  | "provinces"
  | "cities"
  | "categories"
  | "functions"
  | "industries"
  | "salaryBands"
  | "educations"
  | "experiences"
  | "sources";

export interface RadarFilterChip {
  group: RadarFilterKey;
  value: string;
  label: string;
}

function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/** 切换某一维度的某个值（多选）；返回新对象，不改入参 */
export function toggleRadarFilterValue(filter: RadarFilter, group: RadarFilterKey, value: string): RadarFilter {
  if (group === "categories") {
    const categories = filter.categories as string[];
    return { ...filter, categories: toggleValue(categories, value) as RadarCategory[] };
  }
  return { ...filter, [group]: toggleValue(filter[group], value) };
}

/** 清空某一维度 */
export function clearRadarFilterKey(filter: RadarFilter, group: RadarFilterKey): RadarFilter {
  if (group === "categories") return { ...filter, categories: [] };
  return { ...filter, [group]: [] };
}

const FILTER_CHIP_GROUP_ORDER: readonly RadarFilterKey[] = [
  "provinces",
  "cities",
  "categories",
  "functions",
  "industries",
  "salaryBands",
  "educations",
  "experiences",
  "sources",
];

/** 把已选条件摊平成可逐项删除的胶囊（顺序固定，便于渲染稳定） */
export function radarFilterChips(filter: RadarFilter): RadarFilterChip[] {
  const chips: RadarFilterChip[] = [];
  for (const group of FILTER_CHIP_GROUP_ORDER) {
    const values = group === "categories" ? (filter.categories as string[]) : filter[group];
    for (const value of values) {
      chips.push({ group, value, label: radarFilterChipLabel(group, value) });
    }
  }
  return chips;
}

function radarFilterChipLabel(group: RadarFilterKey, value: string): string {
  if (group === "categories") return RADAR_CATEGORY_LABELS[value as RadarCategory] ?? value;
  if (group === "salaryBands") return RADAR_SALARY_OPTIONS.find((option) => option.key === value)?.label ?? value;
  return value;
}

/** 删除一个已选胶囊 */
export function removeRadarFilterChip(filter: RadarFilter, chip: RadarFilterChip): RadarFilter {
  if (chip.group === "categories") {
    return { ...filter, categories: filter.categories.filter((item) => item !== chip.value) };
  }
  return { ...filter, [chip.group]: filter[chip.group].filter((item) => item !== chip.value) };
}

/** 把「省份」选择联动成城市候选：选了省 → 只给这些省的城市；没选 → 全部城市 */
export function citiesForProvinces(provinces: readonly string[], all: readonly string[]): string[] {
  if (provinces.length === 0) return [...all];
  return all.filter((city) => provinces.includes(provinceOfCity(city)));
}
/* ------------------------------------------------------------------ */
/* 筛选预设（v1.62 P1-4）：本地保存 ≤5 个筛选组合                        */
/* ------------------------------------------------------------------ */

/** AsyncStorage key：雷达筛选预设（数组 JSON） */
export const RADAR_PRESET_STORAGE_KEY = "lwb.radar.filters.v1";
/** 预设上限（超出丢最早保存的一个） */
export const RADAR_PRESET_LIMIT = 5;
/** AsyncStorage key：匹配理由折叠的默认状态（"true"/"false"） */
export const RADAR_REASON_STORAGE_KEY = "lwb.radar.reason.v1";

export interface RadarFilterPreset {
  id: string;
  name: string;
  filter: RadarFilter;
  /** ISO 时间戳（用于「超出上限丢最早」与展示） */
  createdAt: string;
}

const RADAR_FILTER_KEYS: readonly RadarFilterKey[] = [
  "provinces",
  "cities",
  "categories",
  "functions",
  "industries",
  "salaryBands",
  "educations",
  "experiences",
  "sources",
];

function uniqueStrings(values: readonly unknown[], allowed?: readonly string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (allowed && !allowed.includes(trimmed)) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * 把任意来源（AsyncStorage / 旧版本 / 脏数据）的筛选对象归一成 RadarFilter：
 * 非对象 → 空筛选；数组只留字符串；类别/薪资档位只留合法枚举；其它维度裁到 50 项。
 */
export function normalizeRadarFilter(value: unknown): RadarFilter {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    // 注意不能只 spread：EMPTY_RADAR_FILTER 里的数组是共享引用，这里必须给新数组
    return {
      provinces: [],
      cities: [],
      categories: [],
      functions: [],
      industries: [],
      salaryBands: [],
      educations: [],
      experiences: [],
      sources: [],
    };
  }
  const record = value as Record<string, unknown>;
  const read = (key: RadarFilterKey): unknown[] =>
    Array.isArray(record[key]) ? (record[key] as unknown[]).slice(0, 50) : [];
  const categories = uniqueStrings(
    read("categories"),
    RADAR_CATEGORY_ORDER.filter((category) => category !== "all"),
  ) as RadarCategory[];
  const salaryBands = uniqueStrings(
    read("salaryBands"),
    RADAR_SALARY_OPTIONS.map((option) => option.key),
  );
  return {
    provinces: uniqueStrings(read("provinces")),
    cities: uniqueStrings(read("cities")),
    categories,
    functions: uniqueStrings(read("functions")),
    industries: uniqueStrings(read("industries")),
    salaryBands,
    educations: uniqueStrings(read("educations")),
    experiences: uniqueStrings(read("experiences")),
    sources: uniqueStrings(read("sources")),
  };
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

/** 两个筛选是否等价（数组顺序无关；用于「当前条件已保存」判定） */
export function isSameRadarFilter(a: RadarFilter, b: RadarFilter): boolean {
  const left = normalizeRadarFilter(a);
  const right = normalizeRadarFilter(b);
  return RADAR_FILTER_KEYS.every((key) =>
    key === "categories"
      ? sameStringSet(left.categories as string[], right.categories as string[])
      : sameStringSet(left[key], right[key]),
  );
}

/**
 * 自动命名：取最靠前的 3 个已选条件，用「·」连接（如「广东·深圳·后端」「互联网·20-30K」）。
 * 条件过多时截断到 24 个字符，避免横向 chip 撑爆屏幕。
 */
export function radarPresetName(filter: RadarFilter): string {
  const normalized = normalizeRadarFilter(filter);
  const parts: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !parts.includes(trimmed) && parts.length < 3) parts.push(trimmed);
  };
  for (const province of normalized.provinces) push(province);
  for (const city of normalized.cities) push(city);
  for (const category of normalized.categories) push(RADAR_CATEGORY_LABELS[category] ?? category);
  for (const fn of normalized.functions) push(fn);
  for (const industry of normalized.industries) push(industry);
  for (const band of normalized.salaryBands) {
    push(RADAR_SALARY_OPTIONS.find((option) => option.key === band)?.label ?? band);
  }
  for (const education of normalized.educations) push(education);
  for (const source of normalized.sources) push(source);
  if (parts.length === 0) return "全部岗位";
  const name = parts.join("·");
  return name.length > 24 ? name.slice(0, 24) + "…" : name;
}

function radarFilterSignature(filter: RadarFilter): string {
  const normalized = normalizeRadarFilter(filter);
  return RADAR_FILTER_KEYS.map((key) => {
    const values = key === "categories" ? (normalized.categories as string[]) : normalized[key];
    return key + ":" + [...values].sort().join(",");
  }).join("|");
}

/** 简易字符串 hash（只用于生成稳定 id，不做安全用途） */
function shortHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** 生成一个预设（id 由 时间 + 筛选签名决定；同名不同条件不会冲突） */
export function createRadarPreset(
  filter: RadarFilter,
  options: { name?: string; now?: number; id?: string } = {},
): RadarFilterPreset {
  const normalized = normalizeRadarFilter(filter);
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const name = String(options.name ?? "").trim() || radarPresetName(normalized);
  const signature = radarFilterSignature(normalized);
  return {
    id: options.id?.trim() || "radar-" + now + "-" + shortHash(signature + "|" + name),
    name,
    filter: normalized,
    createdAt: new Date(now).toISOString(),
  };
}

/** 追加预设：同 id 覆盖、最新的排最前、超出上限丢最早的一个（不修改入参） */
export function addRadarFilterPreset(
  presets: readonly RadarFilterPreset[],
  preset: RadarFilterPreset,
  limit: number = RADAR_PRESET_LIMIT,
): RadarFilterPreset[] {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || RADAR_PRESET_LIMIT));
  const rest = presets.filter((item) => item.id !== preset.id);
  return [normalizeRadarPreset(preset), ...rest].slice(0, safeLimit);
}

function normalizeRadarPreset(value: RadarFilterPreset): RadarFilterPreset {
  const filter = normalizeRadarFilter(value.filter);
  const name = String(value.name ?? "").trim() || radarPresetName(filter);
  const createdAt = typeof value.createdAt === "string" && value.createdAt ? value.createdAt : new Date(0).toISOString();
  return { id: String(value.id ?? "").trim() || "radar-" + createdAt, name, filter, createdAt };
}

export function removeRadarFilterPreset(
  presets: readonly RadarFilterPreset[],
  id: string,
): RadarFilterPreset[] {
  return presets.filter((preset) => preset.id !== id);
}

/** 重命名：名字裁掉首尾空白；空名字保留原名（调用方可用 radarPresetName 兜底） */
export function renameRadarFilterPreset(
  presets: readonly RadarFilterPreset[],
  id: string,
  name: string,
): RadarFilterPreset[] {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return [...presets];
  return presets.map((preset) => (preset.id === id ? { ...preset, name: trimmed.slice(0, 24) } : preset));
}

export function serializeRadarPresets(presets: readonly RadarFilterPreset[]): string {
  return JSON.stringify(presets.slice(0, RADAR_PRESET_LIMIT).map(normalizeRadarPreset));
}

/**
 * 反序列化：容错 AsyncStorage 里的脏数据
 * - 支持 "[]"、直接数组、{ presets: [] } 三种形态；
 * - 非对象条目丢弃；缺少 filter 的条目丢弃；缺 id/name/createdAt 的补齐；
 * - 去重 id、按上限裁剪、按 createdAt 倒序（最新在前）。
 */
export function deserializeRadarPresets(raw: unknown): RadarFilterPreset[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { presets?: unknown }).presets)
      ? ((parsed as { presets: unknown[] }).presets)
      : [];
  const seen = new Set<string>();
  const presets: RadarFilterPreset[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (!record.filter || typeof record.filter !== "object") continue;
    const preset = normalizeRadarPreset({
      id: typeof record.id === "string" ? record.id : "",
      name: typeof record.name === "string" ? record.name : "",
      filter: normalizeRadarFilter(record.filter),
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    });
    if (seen.has(preset.id)) continue;
    seen.add(preset.id);
    presets.push(preset);
  }
  return presets
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RADAR_PRESET_LIMIT);
}

/** 理由折叠默认状态：存 "true"/"false" 字符串（避免 JSON.parse 对旧值的歧义） */
export function serializeRadarReasonExpanded(expanded: boolean): string {
  return expanded ? "true" : "false";
}

/** 解析理由折叠状态：脏数据/旧值（"1"/"0"/json）都能吃，默认收起 */
export function parseRadarReasonExpanded(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  return false;
}

/**
 * 岗位卡的「匹配理由」摘要（默认一行）：命中技能数 / 缺失技能数 / 方向。
 * 展开时组件用 missingSkills 渲染具体缺失技能列表。
 */
export function radarMatchSummary(job: RadarJobLike & {
  matchedSkills?: readonly { skill: string }[];
  missingSkills?: readonly { skill: string }[];
}): { hitCount: number; missingCount: number; direction: string; label: string } {
  const hitCount = Array.isArray(job.matchedSkills) ? job.matchedSkills.length : 0;
  const missingCount = Array.isArray(job.missingSkills) ? job.missingSkills.length : 0;
  const direction = radarDirectionLabel(job);
  const hitLabel = hitCount > 0 ? "命中 " + hitCount + " 项技能" : "技能命中待补充";
  const missingLabel = missingCount > 0 ? "还缺 " + missingCount + " 项" : "技能已全命中";
  return {
    hitCount,
    missingCount,
    direction,
    label: hitLabel + " · " + missingLabel + " · 方向 " + direction,
  };
}
