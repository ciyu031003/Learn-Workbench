import { pgPool } from "@/lib/db";

/* ================= 招聘市场分析（P4，实时聚合 + 60s 缓存） =================
 * 评审建议 6：当前数据量小，实时 SQL 聚合足够快，暂不建 market_stats 结果表；
 * 数据量 >5 万条后再考虑定时聚合落表。
 */

export interface MarketCityRow { city: string; count: number; avgMin: number | null; avgMax: number | null; }
export interface MarketSkillRow { skill: string; count: number; }
export interface MarketSalaryRow { label: string; min: number; count: number; }
export interface MarketEduRow { label: string; count: number; }
export interface MarketExpRow { label: string; count: number; }

export interface MarketPlatformRow { label: string; count: number; }
export interface MarketJobTypeRow { label: string; count: number; }
export interface MarketSkillSalaryRow { skill: string; avgSalary: number | null; count: number; }

export interface MarketAnalysis {
  total: number;
  byCity: MarketCityRow[];       // 城市需求
  bySkill: MarketSkillRow[];     // 技能热度
  salaryDist: MarketSalaryRow[]; // 薪资分布
  byEducation: MarketEduRow[];   // 学历需求
  byExperience: MarketExpRow[];  // 经验需求
  byFunction: MarketExpRow[];    // 岗位职能方向 TOP（清洗公司名脏 title 后按关键词分类）
  byPlatform: MarketPlatformRow[]; // 数据来源平台分布
  byJobType: MarketJobTypeRow[];   // 岗位类型占比（全职/实习/外包/兼职）
  skillSalary: MarketSkillSalaryRow[]; // 技能-薪资相关性（job_skill_links JOIN）
  generatedAt: string;
}

/** 数据来源平台中文名 */
const SOURCE_LABELS: Record<string, string> = {
  lagou: "拉勾", liepin: "猎聘", zhilian: "智联", job51: "前程无忧", boss: "Boss直聘",
  "sasac-recruit": "国资委", "cpta-notice": "人事考试网", "81rc": "军队人才网",
  "mohrss-sydw": "人社部", "jiangsu-sydw": "江苏人社", iguopin: "国聘",
  guokao: "国考",
};

// 60s 内存缓存（单进程；Docker 单实例下有效）
let cache: { at: number; data: MarketAnalysis } | null = null;
const TTL = 60_000;

/** 薪资分桶（K/月） */
const SALARY_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "10K 以下", min: 0, max: 10 },
  { label: "10-15K", min: 10, max: 15 },
  { label: "15-20K", min: 15, max: 20 },
  { label: "20-30K", min: 20, max: 30 },
  { label: "30K 以上", min: 30, max: 1_000 },
];

/** 学历归一（宽松） */
function eduBucket(raw: string): string {
  const s = raw ?? "";
  if (s.includes("博士")) return "博士";
  if (s.includes("硕士")) return "硕士";
  if (s.includes("本科")) return "本科";
  if (s.includes("大专")) return "大专";
  return "不限/其他";
}

/** 经验归一（宽松） */
function expBucket(raw: string): string {
  const s = raw ?? "";
  if (s.includes("10年以上")) return "10年以上";
  if (s.includes("5-10") || s.includes("5-10年")) return "5-10年";
  if (s.includes("3-5")) return "3-5年";
  if (s.includes("1-3")) return "1-3年";
  if (s.includes("应届")) return "应届";
  return "不限/其他";
}

/** 公司名特征（zhilian/liepin 源把公司名写进 title 的脏数据清洗） */
const COMPANY_RE =
  /(公司|科技|数据|网络|信息|智能|集团|股份|有限|技术|软件|电子|通信|咨询|研究院|事务所|银行|证券|保险|置业|地产|物流|贸易|生物|医疗|教育|研究院$)/;

/** 岗位职能分类（按 title 关键词，优先级从高到低） */
const FUNCTION_RULES: { label: string; re: RegExp }[] = [
  { label: "前端", re: /(前端|web前端|webs?前端|javascript工程师|vue|react工程师|uniapp)/i },
  { label: "后端", re: /(后端|java开发|python开发|golang|go开发|c\+\+|c#|node.?js|php开发|中间件)/i },
  { label: "算法/AI", re: /(算法|ai|人工智能|机器学习|深度学习|大模型|llm|nlp|cv|视觉|推荐算法|数据挖掘)/i },
  { label: "测试", re: /(测试|qa|质量保障|测开)/i },
  { label: "运维/DevOps", re: /(运维|devops|sre|系统工程师|网络工程师|数据库管理员|dba|linux|k8s|容器)/i },
  { label: "数据", re: /(数据|etl|数仓|bi|数据分析师|大数据|sql)/i },
  { label: "产品", re: /(产品|pm|需求)/i },
  { label: "设计", re: /(设计|ui|ux|视觉|交互)/i },
  { label: "运营/市场", re: /(运营|市场|销售|商务|客服|品牌|推广)/i },
  { label: "安全", re: /(安全|渗透|等保|风控)/i },
  { label: "硬件/嵌入式", re: /(硬件|嵌入式|fpga|芯片|ic|单片机|stm32|电路)/i },
];

/** 岗位职能方向分类（返回 null 表示公司名脏数据或无法归类） */
function classifyFunction(title: string): string | null {
  const t = (title ?? "").trim();
  if (!t || COMPANY_RE.test(t)) return null;
  for (const rule of FUNCTION_RULES) {
    if (rule.re.test(t)) return rule.label;
  }
  return "其他";
}

/** 岗位类型（全职/实习/外包/兼职） */
function classifyJobType(title: string, tags: string[]): string {
  const s = (title ?? "") + " " + (tags ?? []).join(" ");
  if (/(实习|intern|internship)/i.test(s)) return "实习";
  if (/(外包|驻场|外派)/.test(s)) return "外包";
  if (/(兼职|part[- ]?time)/i.test(s)) return "兼职";
  return "全职";
}

export async function analyzeMarket(): Promise<MarketAnalysis> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.data;

  // 只统计招聘岗位类（排除公告/考试事件，它们不代表市场招聘需求）
  const whereJob = "is_active = true AND channel = 'job'";

  const totalRes = await pgPool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM job_postings WHERE ${whereJob}`
  );
  const total = totalRes.rows[0]?.n ?? 0;

  // 城市需求（count + 平均薪资）
  const cityRes = await pgPool.query<{ city: string; count: number; avg_min: number | null; avg_max: number | null }>(
    `SELECT COALESCE(NULLIF(city,''),'全国') AS city,
            count(*)::int AS count,
            round(avg(salary_min)::numeric)::int AS avg_min,
            round(avg(salary_max)::numeric)::int AS avg_max
       FROM job_postings
      WHERE ${whereJob}
      GROUP BY COALESCE(NULLIF(city,''),'全国')
      ORDER BY count DESC LIMIT 15`
  );
  const byCity: MarketCityRow[] = cityRes.rows.map((r) => ({
    city: r.city,
    count: r.count,
    avgMin: r.avg_min,
    avgMax: r.avg_max,
  }));

  // 技能热度（tags 展开）
  const skillRes = await pgPool.query<MarketSkillRow>(
    `SELECT jsonb_array_elements_text(tags) AS skill, count(*)::int AS count
       FROM job_postings
      WHERE ${whereJob} AND jsonb_array_length(tags) > 0
      GROUP BY skill ORDER BY count DESC LIMIT 20`
  );
  const bySkill = skillRes.rows;

  // 薪资分布（salary_min/salary_max 分桶）
  const salaryRes = await pgPool.query<{ min: number | null; max: number | null }>(
    `SELECT salary_min AS min, salary_max AS max FROM job_postings WHERE ${whereJob}`
  );
  const salaryDist = SALARY_BUCKETS.map((b) => {
    const count = salaryRes.rows.filter((r) => {
      const m = r.max ?? r.min;
      if (m == null) return false;
      return m >= b.min && m < b.max;
    }).length;
    return { label: b.label, min: b.min, count };
  });

  // 学历需求
  const eduMap = new Map<string, number>();
  const eduRes = await pgPool.query<{ education: string }>(
    `SELECT education FROM job_postings WHERE ${whereJob} AND education <> ''`
  );
  for (const r of eduRes.rows) {
    const k = eduBucket(r.education);
    eduMap.set(k, (eduMap.get(k) ?? 0) + 1);
  }
  const byEducation = Array.from(eduMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const expMap = new Map<string, number>();
  const expRes = await pgPool.query<{ experience: string }>(
    `SELECT experience FROM job_postings WHERE ${whereJob} AND experience <> ''`
  );
  for (const r of expRes.rows) {
    const k = expBucket(r.experience);
    expMap.set(k, (expMap.get(k) ?? 0) + 1);
  }
  const byExperience = Array.from(expMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 岗位职能方向（清洗公司名脏 title 后按关键词分类）
  const fnRes = await pgPool.query<{ title: string; tags: string[] }>(
    `SELECT title, tags FROM job_postings WHERE ${whereJob}`
  );
  const fnMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const platformMap = new Map<string, number>();
  for (const r of fnRes.rows) {
    const fn = classifyFunction(r.title);
    if (fn) fnMap.set(fn, (fnMap.get(fn) ?? 0) + 1);
    const jt = classifyJobType(r.title, Array.isArray(r.tags) ? r.tags.map(String) : []);
    typeMap.set(jt, (typeMap.get(jt) ?? 0) + 1);
  }
  const byFunction: MarketExpRow[] = Array.from(fnMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 平台分布
  const platRes = await pgPool.query<{ source: string }>(
    `SELECT source FROM job_postings WHERE ${whereJob}`
  );
  for (const r of platRes.rows) {
    const label = SOURCE_LABELS[r.source] ?? r.source;
    platformMap.set(label, (platformMap.get(label) ?? 0) + 1);
  }
  const byPlatform: MarketPlatformRow[] = Array.from(platformMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  const byJobType: MarketJobTypeRow[] = Array.from(typeMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 技能-薪资相关性（job_skill_links JOIN job_postings 平均薪资，P2 已建成）
  const ssRes = await pgPool.query<{ skill: string; avg: number | null; n: number }>(
    `SELECT s.name AS skill,
            round(avg(COALESCE(j.salary_max, j.salary_min))::numeric)::int AS avg,
            count(*)::int AS n
       FROM job_skill_links l
       JOIN skill_taxonomy s ON s.id = l.skill_id
       JOIN job_postings j ON j.id = l.job_id
      WHERE j.is_active = true AND j.channel = 'job'
        AND j.salary_max IS NOT NULL
      GROUP BY s.name
      ORDER BY n DESC, avg DESC
      LIMIT 15`
  );
  const skillSalary: MarketSkillSalaryRow[] = ssRes.rows.map((r) => ({
    skill: r.skill,
    avgSalary: r.avg,
    count: r.n,
  }));

  const data: MarketAnalysis = {
    total,
    byCity,
    bySkill,
    salaryDist,
    byEducation,
    byExperience,
    byFunction,
    byPlatform,
    byJobType,
    skillSalary,
    generatedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return data;
}

/** 清空缓存（爬虫抓取后调用，保证最新） */
export function invalidateMarketCache(): void {
  cache = null;
}
