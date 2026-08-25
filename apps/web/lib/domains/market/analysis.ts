import { pgPool } from "@/lib/db";
import type { MarketAnalysis, MarketCityRow, MarketExpRow, MarketJobTypeRow, MarketOverview, MarketPlatformRow, MarketSkillRow, MarketSkillSalaryRow } from "./types";
import { functionRules, jobTypeRules, makeFunctionRule, companyNameRe, salaryBuckets, sourceLabels } from "@learn-workbench/config";

/* ================= 招聘市场分析（P4，实时聚合 + DB 缓存） =================
 * P1：聚合结果落 market_stats 表（60s TTL，多实例共享、重启不丢）；
 * 数据量增长后可将刷新改为定时任务（见 docs/P0-安全加固与HTTPS部署.md P1 说明）。
 */




/** P1：市场分析改为 DB 缓存（market_stats 表，多实例共享 + 重启不丢）；60s TTL */
const CACHE_KEY = "full";
const CACHE_TTL_MS = 60_000;

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



/** 编译后的职能规则（模块加载期编译一次） */
const compiledFunctionRules = functionRules.map(makeFunctionRule);
const compiledJobTypeRules = jobTypeRules.map((r) => ({ label: r.label, re: new RegExp(r.pattern, "i") }));

/** 岗位职能方向分类（返回 null 表示公司名脏数据或无法归类） */
function classifyFunction(title: string): string | null {
  const t = (title ?? "").trim();
  if (!t || companyNameRe.test(t)) return null;
  for (const rule of compiledFunctionRules) {
    if (rule.re.test(t)) return rule.label;
  }
  return "其他";
}

/** 岗位类型（全职/实习/外包/兼职） */
function classifyJobType(title: string, tags: string[]): string {
  const s = (title ?? "") + " " + (tags ?? []).join(" ");
  for (const rule of compiledJobTypeRules) {
    if (rule.re.test(s)) return rule.label;
  }
  return "全职";
}

export async function analyzeMarket(): Promise<MarketAnalysis> {
  // 读 DB 缓存：命中且新鲜则直接返回（避免每次全表聚合）
  const cached = await pgPool.query<{ payload: MarketAnalysis; computed_at: Date }>(
    `SELECT payload, computed_at FROM market_stats WHERE key = $1`,
    [CACHE_KEY]
  );
  const cachedRow = cached.rows[0];
  if (cachedRow?.payload && Date.now() - new Date(cachedRow.computed_at).getTime() < CACHE_TTL_MS) {
    return cachedRow.payload;
  }

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
  const salaryDist = salaryBuckets.map((b) => {
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
    const label = sourceLabels[r.source] ?? r.source;
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

  // 市场概览（第一屏 KPI）：城市去重数 / 热门技能数 / 整体平均+中位薪资（均真实取数）
  const cityCountRes = await pgPool.query<{ n: number }>(
    `SELECT count(DISTINCT COALESCE(NULLIF(city,''),'全国'))::int AS n FROM job_postings WHERE ${whereJob}`
  );
  const skillCountRes = await pgPool.query<{ n: number }>(
    `SELECT count(DISTINCT jsonb_array_elements_text(tags))::int AS n
       FROM job_postings
      WHERE ${whereJob} AND jsonb_array_length(tags) > 0`
  );
  const salaryVals = salaryRes.rows
    .map((r) => r.max ?? r.min)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);
  const avgSalary = salaryVals.length ? Math.round(salaryVals.reduce((a, b) => a + b, 0) / salaryVals.length) : null;
  const overview: MarketOverview = {
    total,
    cityCount: cityCountRes.rows[0]?.n ?? 0,
    skillCount: skillCountRes.rows[0]?.n ?? 0,
    avgSalary,
    medianSalary: medianOf(salaryVals),
  };

  const data: MarketAnalysis = {
    total,
    overview,
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
  // 写回 DB 缓存（失败不影响响应；下次请求再算）
  await pgPool
    .query(
      `INSERT INTO market_stats (key, payload, computed_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
      [CACHE_KEY, JSON.stringify(data)]
    )
    .catch(() => {});
  return data;
}

/** 爬虫写入新数据后调用：清掉市场分析缓存（下次请求重算，避免读到旧数据） */
export async function invalidateMarketCache(): Promise<void> {
  await pgPool.query(`DELETE FROM market_stats WHERE key = $1`, [CACHE_KEY]).catch(() => {});
}

/** 升序数组取中位数（空返回 null） */
function medianOf(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
