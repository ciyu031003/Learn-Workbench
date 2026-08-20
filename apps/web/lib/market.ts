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

export interface MarketAnalysis {
  total: number;
  byCity: MarketCityRow[];       // 城市需求
  bySkill: MarketSkillRow[];     // 技能热度
  salaryDist: MarketSalaryRow[]; // 薪资分布
  byEducation: MarketEduRow[];   // 学历需求
  byExperience: MarketExpRow[];  // 经验需求
  generatedAt: string;
}

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

  const data: MarketAnalysis = {
    total,
    byCity,
    bySkill,
    salaryDist,
    byEducation,
    byExperience,
    generatedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return data;
}

/** 清空缓存（爬虫抓取后调用，保证最新） */
export function invalidateMarketCache(): void {
  cache = null;
}
