/**
 * 就业雷达的**纯筛选 / 排序逻辑**（零 react-native import → 可单测）。
 *
 * 真机反馈（2026-09-24）：雷达只有一条"永远往下滑"的列表，不能筛选、不能切换。
 * 这里把「领域（岗位方向）/ 城市 / 考公考编 / 互联网」与「匹配度排序」抽成纯函数，
 * 屏幕组件只负责把筛选结果渲染出来（一次拉全候选集，本地即时筛选，不再请求服务器）。
 */

export interface RadarJobLike {
  title: string;
  company: string;
  city: string;
  /** 岗位方向（function_key） */
  functionKey?: string;
  /** 行业（industry_sector） */
  industrySector?: string;
  overall: number;
  gapHours?: number;
}

export type RadarCategory = "all" | "internet" | "civil" | "state" | "other";
export type RadarSort = "match_desc" | "match_asc";

export const RADAR_CATEGORY_LABELS: Record<RadarCategory, string> = {
  all: "全部",
  internet: "互联网",
  civil: "考公考编",
  state: "国企央企",
  other: "其它",
};

export const RADAR_CATEGORY_ORDER: RadarCategory[] = ["all", "internet", "civil", "state", "other"];

export const RADAR_SORT_LABELS: Record<RadarSort, string> = {
  match_desc: "匹配度高 → 低",
  match_asc: "匹配度低 → 高",
};

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

export interface RadarFilter {
  city: string | null;
  category: RadarCategory;
  /** 岗位方向（function_key），null = 全部 */
  functionKey: string | null;
}

export const EMPTY_RADAR_FILTER: RadarFilter = { city: null, category: "all", functionKey: null };

export function filterRadar<T extends RadarJobLike>(jobs: T[], filter: RadarFilter): T[] {
  return jobs.filter((j) => {
    if (filter.city && j.city !== filter.city) return false;
    if (filter.functionKey && j.functionKey !== filter.functionKey) return false;
    if (filter.category !== "all" && radarCategoryOf(j) !== filter.category) return false;
    return true;
  });
}

export function sortRadar<T extends RadarJobLike>(jobs: T[], sort: RadarSort): T[] {
  const byGap = (a: T, b: T) => (a.gapHours ?? 0) - (b.gapHours ?? 0);
  return [...jobs].sort((a, b) =>
    sort === "match_asc" ? a.overall - b.overall || byGap(a, b) : b.overall - a.overall || byGap(a, b)
  );
}

/** 组合：筛选 + 排序 */
export function applyRadarFilter<T extends RadarJobLike>(jobs: T[], filter: RadarFilter, sort: RadarSort): T[] {
  return sortRadar(filterRadar(jobs, filter), sort);
}

/** 从候选集里推导出可用的筛选项（城市 / 岗位方向），用于渲染 chips */
export function radarFacets<T extends RadarJobLike>(jobs: T[]): { cities: string[]; functions: string[] } {
  const uniq = (xs: string[]) => [...new Set(xs.filter((x) => x && x.trim()))].sort((a, b) => a.localeCompare(b, "zh"));
  return {
    cities: uniq(jobs.map((j) => j.city)),
    functions: uniq(jobs.map((j) => j.functionKey ?? "")),
  };
}
