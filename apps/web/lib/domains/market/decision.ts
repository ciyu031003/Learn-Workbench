import { pgPool } from "@/lib/db";
import { listUserSkills } from "@/lib/skills";

const ACTIVE_JOB = "is_active = true AND channel = 'job'";

export interface MarketDecisionMove {
  key: string;
  label: string;
  count: number;
  medianSalary: number | null;
  score: number;
  reason: string;
}

export interface MarketDecisionScenario {
  city: string;
  functionKey: string;
  totalJobs: number;
  medianSalary: number | null;
  avgSalary: number | null;
  topSkills: string[];
  reachableJobs: number | null;
  missingSkills: string[];
  suggestions: string[];
}

export interface MarketDecisionPayload {
  generatedAt: string;
  hotspots: MarketDecisionMove[];
  migrations: MarketDecisionMove[];
  alerts: MarketDecisionMove[];
  scenario: MarketDecisionScenario;
}

interface MoveRow {
  key: string;
  count: number;
  median_salary: string | null;
  recent_count: number | null;
}

function median(row: MoveRow): number | null {
  return row.median_salary == null ? null : Number(row.median_salary);
}

function score(row: MoveRow): number {
  return Number(row.count) + (median(row) ?? 0) * 0.35 + Number(row.recent_count ?? 0) * 1.2;
}

export async function getMarketDecision(
  userId: string | null,
  target: { city?: string; functionKey?: string } = {}
): Promise<MarketDecisionPayload> {
  const city = target.city?.trim() || "深圳";
  const functionKey = target.functionKey?.trim() || "后端";

  const [hotspotRows, migrationRows, alertRows, scenarioRows, skillRows] = await Promise.all([
    pgPool.query<MoveRow>(
      `SELECT COALESCE(NULLIF(function_key, ''), '其他') AS key,
              count(*)::int AS count,
              count(*) FILTER (WHERE fetched_at >= now() - interval '7 days')::int AS recent_count,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary
         FROM job_postings
        WHERE ${ACTIVE_JOB}
        GROUP BY key
        ORDER BY count DESC
        LIMIT 8`
    ),
    pgPool.query<MoveRow>(
      `SELECT city AS key,
              count(*)::int AS count,
              count(*) FILTER (WHERE fetched_at >= now() - interval '7 days')::int AS recent_count,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary
         FROM job_postings
        WHERE ${ACTIVE_JOB} AND city <> ''
        GROUP BY city
        ORDER BY count DESC, median_salary DESC
        LIMIT 8`
    ),
    pgPool.query<MoveRow>(
      `SELECT COALESCE(NULLIF(function_key, ''), '其他') AS key,
              count(*)::int AS count,
              count(*) FILTER (WHERE fetched_at >= now() - interval '7 days')::int AS recent_count,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary
         FROM job_postings
        WHERE ${ACTIVE_JOB}
        GROUP BY key
        ORDER BY recent_count DESC, count DESC
        LIMIT 6`
    ),
    pgPool.query<{
      total_jobs: number;
      median_salary: string | null;
      avg_salary: number | null;
    }>(
      `SELECT count(*)::int AS total_jobs,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary,
              round(avg(LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)))::int AS avg_salary
         FROM job_postings
        WHERE ${ACTIVE_JOB} AND city = $1 AND COALESCE(NULLIF(function_key, ''), '其他') = $2`,
      [city, functionKey]
    ),
    pgPool.query<{ skill: string }>(
      `SELECT skill
         FROM job_postings
         CROSS JOIN LATERAL jsonb_array_elements_text(tags) AS skill
        WHERE ${ACTIVE_JOB} AND city = $1 AND COALESCE(NULLIF(function_key, ''), '其他') = $2
        GROUP BY skill
        ORDER BY count(*) DESC
        LIMIT 10`,
      [city, functionKey]
    ),
  ]);

  const moves = (rows: MoveRow[], reason: string): MarketDecisionMove[] =>
    rows
      .map((row) => ({
        key: row.key,
        label: row.key,
        count: Number(row.count),
        medianSalary: median(row),
        score: score(row),
        reason,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

  const scenario = scenarioRows.rows[0] ?? { total_jobs: 0, median_salary: null, avg_salary: null };
  const topSkills = skillRows.rows.map((row) => row.skill).slice(0, 6);
  const strongSkills = userId ? (await listUserSkills(userId)).filter((skill) => skill.level >= 2).map((skill) => skill.name) : [];
  const missingSkills = topSkills.filter((skill) => !strongSkills.some((name) => name.toLowerCase() === skill.toLowerCase()));

  let reachableJobs: number | null = null;
  if (strongSkills.length) {
    const reachable = await pgPool.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM job_postings
        WHERE ${ACTIVE_JOB}
          AND city = $1
          AND COALESCE(NULLIF(function_key, ''), '其他') = $2
          AND tags ?| $3::text[]`,
      [city, functionKey, strongSkills]
    );
    reachableJobs = Number(reachable.rows[0]?.n ?? 0);
  }

  const suggestions = [
    `${city} · ${functionKey} 当前共有 ${Number(scenario.total_jobs)} 个活跃岗位`,
    scenario.median_salary != null ? `薪资中位数约 ${Number(scenario.median_salary)}K/月` : "该组合暂无可计算薪资",
    reachableJobs != null ? `你的技能当前可触达 ${reachableJobs} 个岗位` : "登录并补充技能后可计算可触达岗位",
    missingSkills.length ? `优先补：${missingSkills.slice(0, 4).join(" / ")}` : "你的核心技能与当前目标需求较匹配",
  ];

  return {
    generatedAt: new Date().toISOString(),
    hotspots: moves(hotspotRows.rows, "职能需求热度"),
    migrations: moves(migrationRows.rows, "城市机会指数"),
    alerts: moves(alertRows.rows, "近 7 天升温"),
    scenario: {
      city,
      functionKey,
      totalJobs: Number(scenario.total_jobs),
      medianSalary: scenario.median_salary == null ? null : Number(scenario.median_salary),
      avgSalary: scenario.avg_salary == null ? null : Number(scenario.avg_salary),
      topSkills,
      reachableJobs,
      missingSkills,
      suggestions,
    },
  };
}
