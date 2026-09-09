import type {
  MarketAnalysis,
  MarketCityRow,
  MarketSkillSalaryRow,
} from "@/lib/domains/market/types";

export type MarketStoryChapterId = "cover" | "scale" | "cities" | "talent" | "salary" | "skills" | "learning";

export interface MarketStoryRankItem {
  label: string;
  value: number;
  note?: string;
}

export interface MarketStoryChapter {
  id: MarketStoryChapterId;
  index: string;
  kicker: string;
  title: string;
  subtitle: string;
  conclusion: string;
}

function top<T>(items: T[], score: (item: T) => number): T | null {
  return items.length ? [...items].sort((a, b) => score(b) - score(a))[0] : null;
}

function cityNote(city: MarketCityRow): string | undefined {
  if (city.avgMin == null && city.avgMax == null) return undefined;
  return `均 ${city.avgMin ?? "—"}-${city.avgMax ?? "—"}K`;
}

export function buildMarketStory(data: MarketAnalysis): MarketStoryChapter[] {
  const topCity = top(data.byCity, (c) => c.count);
  const topSkill = top(data.bySkill, (s) => s.count);
  const topSalarySkill = top(
    (data.skillSalary ?? []).filter((s) => s.avgSalary != null && s.count > 0),
    (s) => s.avgSalary ?? 0
  );
  const topFunction = top(data.byFunction, (f) => f.count);
  const topEducation = top(data.byEducation, (e) => e.count);
  const topExperience = top(data.byExperience, (e) => e.count);
  const cityCount = data.byCity.length;
  const skillCount = data.bySkill.length;
  const avgSalary = data.overview?.avgSalary ?? null;

  return [
    {
      id: "cover",
      index: "00",
      kicker: "MARKET OVERVIEW",
      title: "先看看整体市场有多大",
      subtitle: `当前样本 ${data.total} 个招聘岗位，覆盖 ${cityCount} 个城市。`,
      conclusion: `当前机会最多的职能方向是「${topFunction?.label ?? "待积累"}」，热门技能 ${skillCount} 个。`,
    },
    {
      id: "scale",
      index: "01",
      kicker: "MARKET SCALE",
      title: "岗位职能方向",
      subtitle: "不同职能方向的需求规模差异明显。",
      conclusion: `「${topFunction?.label ?? "待积累"}」以 ${topFunction?.count ?? 0} 个岗位领先。`,
    },
    {
      id: "cities",
      index: "02",
      kicker: "CITY OPPORTUNITY",
      title: "机会集中在哪些城市",
      subtitle: `Top 城市共统计 ${data.byCity.reduce((a, c) => a + c.count, 0)} 个岗位。`,
      conclusion: `「${topCity?.city ?? "待积累"}」当前机会最多，共 ${topCity?.count ?? 0} 个岗位${cityNote(topCity ?? { city: "", count: 0, avgMin: null, avgMax: null }) ? `，${cityNote(topCity ?? { city: "", count: 0, avgMin: null, avgMax: null })}` : ""}。`,
    },
    {
      id: "talent",
      index: "03",
      kicker: "TALENT PROFILE",
      title: "人才画像",
      subtitle: "学历与经验要求反映招聘方的准入门槛。",
      conclusion: `学历需求最高的是「${topEducation?.label ?? "待积累"}」，经验要求最高的是「${topExperience?.label ?? "待积累"}」。`,
    },
    {
      id: "salary",
      index: "04",
      kicker: "SALARY DISTRIBUTION",
      title: "薪资分布",
      subtitle: "不同区间岗位数量反映市场定价。",
      conclusion: `当前平均薪资约为 ${avgSalary != null ? `${avgSalary}K` : "待积累"}${topSalarySkill ? `，平均薪资最高的技能是「${topSalarySkill.skill}」` : ""}。`,
    },
    {
      id: "skills",
      index: "05",
      kicker: "SKILL OPPORTUNITY",
      title: "什么技能值得学习",
      subtitle: "结合热度与平均薪资，找出更有价值的能力方向。",
      conclusion: `热度最高的技能是「${topSkill?.skill ?? "待积累"}」，共 ${topSkill?.count ?? 0} 个岗位关联。`,
    },
    {
      id: "learning",
      index: "06",
      kicker: "MY LEARNING OPPORTUNITY",
      title: "我的学习机会",
      subtitle: "把市场洞察转化为你的学习路线。",
      conclusion: "登录后查看能力缺口，并可以把高频技能一键加入学习路线。",
    },
  ];
}

export function buildStoryRanks(data: MarketAnalysis) {
  return {
    functions: data.byFunction.slice(0, 8).map((f) => ({ label: f.label, value: f.count })),
    cities: data.byCity.slice(0, 12).map((c) => ({ label: c.city, value: c.count, note: cityNote(c) })),
    salary: data.salaryDist.map((s) => ({ label: s.label, value: s.count })),
    skills: data.bySkill.slice(0, 10).map((s) => ({ label: s.skill, value: s.count })),
  };
}

export function buildStoryScatter(data: MarketAnalysis) {
  return (data.skillSalary ?? [])
    .filter((n): n is MarketSkillSalaryRow => n.avgSalary != null && n.count > 0)
    .map((n) => ({
      label: n.skill,
      count: n.count,
      salary: n.avgSalary as number,
    }));
}

export type StoryChapter = MarketStoryChapter;
export type StoryRankItem = MarketStoryRankItem;
