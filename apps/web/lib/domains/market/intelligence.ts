import { pgPool } from "@/lib/db";
import { analyzeMarket } from "./analysis";
import { readGlobalMarketTimeSeries } from "./snapshots";

export type MarketIntelligenceRange = 7 | 30 | 90;

export interface MarketIntelligenceFilters {
  q?: string;
  city?: string;
  functionKey?: string;
  industrySector?: string;
  industrySubsector?: string;
  seniorityBucket?: string;
  source?: string;
  salaryMin?: number;
  salaryMax?: number;
  range?: MarketIntelligenceRange;
}

export interface MarketFacetItem {
  key: string;
  label: string;
  count: number;
}

export interface MarketRankItem {
  key: string;
  label: string;
  count: number;
  medianSalary?: number | null;
  avgSalary?: number | null;
}

export interface MarketIndustryItem {
  sector: string;
  subsector: string;
  count: number;
}

export interface MarketSalaryItem {
  label: string;
  count: number;
}

export interface MarketTimePoint {
  date: string;
  newJobs: number;
  medianSalary: number | null;
  avgSalary: number | null;
}

export interface MarketIntelligencePayload {
  generatedAt: string;
  filters: MarketIntelligenceFilters;
  summary: {
    total: number;
    cityCount: number;
    skillCount: number;
    avgSalary: number | null;
    medianSalary: number | null;
    last7DaysJobs: number;
  };
  facets: {
    cities: MarketFacetItem[];
    functions: MarketFacetItem[];
    industries: MarketFacetItem[];
    seniorities: MarketFacetItem[];
    sources: MarketFacetItem[];
  };
  distributions: {
    byCity: MarketRankItem[];
    byFunction: MarketRankItem[];
    byIndustry: MarketIndustryItem[];
    bySeniority: MarketFacetItem[];
    bySalary: MarketSalaryItem[];
    bySkill: MarketRankItem[];
  };
  timeSeries: MarketTimePoint[];
}

const ACTIVE_JOB = "is_active = true AND channel = 'job'";

function addFilter(
  parts: string[],
  args: unknown[],
  expression: string,
  value?: string | number
) {
  if (value === undefined || value === null || value === "") return;
  parts.push(expression.replace("$N", `$${args.length + 1}`));
  args.push(value);
}

function buildWhere(filters: MarketIntelligenceFilters) {
  const parts = [ACTIVE_JOB];
  const args: unknown[] = [];

  if (filters.q) {
    addFilter(parts, args, `(title ILIKE $N OR company ILIKE $N OR tags::text ILIKE $N)`, `%${filters.q}%`);
  }
  addFilter(parts, args, "city = $N", filters.city);
  addFilter(parts, args, "function_key = $N", filters.functionKey);
  addFilter(parts, args, "industry_sector = $N", filters.industrySector);
  addFilter(parts, args, "industry_subsector = $N", filters.industrySubsector);
  addFilter(parts, args, "seniority_bucket = $N", filters.seniorityBucket);
  addFilter(parts, args, "source = $N", filters.source);

  if (typeof filters.salaryMin === "number") {
    addFilter(parts, args, "COALESCE(salary_max, salary_min, 0) >= $N * 100", filters.salaryMin);
  }
  if (typeof filters.salaryMax === "number") {
    addFilter(parts, args, "COALESCE(salary_max, salary_min, 0) <= $N * 100", filters.salaryMax);
  }

  return { where: parts.join(" AND "), args };
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fillSeries(rows: MarketTimePoint[], range: number): MarketTimePoint[] {
  const points = new Map(rows.map((row) => [row.date, row]));
  const result: MarketTimePoint[] = [];
  const today = new Date();
  for (let offset = range - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    const date = dateKey(current);
    const matched = points.get(date);
    result.push(
      matched ?? {
        date,
        newJobs: 0,
        medianSalary: null,
        avgSalary: null,
      }
    );
  }
  return result;
}

export async function queryMarketIntelligence(
  filters: MarketIntelligenceFilters = {}
): Promise<MarketIntelligencePayload> {
  const range: MarketIntelligenceRange =
    filters.range === 7 || filters.range === 30 || filters.range === 90
      ? filters.range
      : 90;
  const normalized = { ...filters, range };
  const isGlobal = !(
    normalized.q ||
    normalized.city ||
    normalized.functionKey ||
    normalized.industrySector ||
    normalized.industrySubsector ||
    normalized.seniorityBucket ||
    normalized.source ||
    normalized.salaryMin != null ||
    normalized.salaryMax != null
  );
  const { where, args } = buildWhere(normalized);
  const baseArgs = normalized.q
    ? [`%${normalized.q}%`]
    : [];

  const summarySql = `
    SELECT count(*)::int AS total,
           count(DISTINCT city)::int AS city_count,
           round(avg(LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)))::int AS avg_salary,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary,
           count(*) FILTER (WHERE fetched_at >= now() - interval '7 days')::int AS last_7_days_jobs
      FROM job_postings
     WHERE ${where}
  `;

  const skillCountSql = `
    SELECT count(DISTINCT tag)::int AS skill_count
      FROM job_postings
      CROSS JOIN LATERAL jsonb_array_elements_text(tags) AS tag
     WHERE ${where}
  `;

  const [summaryRes, skillRes, cities, functions, industries, seniorities, sources, byCity, byFunction, byIndustry, bySeniority, bySalary, bySkill, seriesRes] = await Promise.all([
    pgPool.query<{
      total: number;
      city_count: number;
      avg_salary: number | null;
      median_salary: string | null;
      last_7_days_jobs: number;
    }>(summarySql, args),
    pgPool.query<{ skill_count: number }>(skillCountSql, args),
    pgPool.query<{ key: string; count: number }>(
      `SELECT COALESCE(NULLIF(city, ''), '全国') AS key, count(*)::int AS count
         FROM job_postings WHERE ${ACTIVE_JOB}
        GROUP BY key ORDER BY count DESC LIMIT 20`,
      baseArgs
    ),
    pgPool.query<{ key: string; count: number }>(
      `SELECT COALESCE(NULLIF(function_key, ''), '其他') AS key, count(*)::int AS count
         FROM job_postings WHERE ${ACTIVE_JOB}
        GROUP BY key ORDER BY count DESC LIMIT 15`,
      baseArgs
    ),
    pgPool.query<{ sector: string; subsector: string; count: number }>(
      `SELECT COALESCE(NULLIF(industry_sector, ''), '其他') AS sector,
              COALESCE(NULLIF(industry_subsector, ''), '其他') AS subsector,
              count(*)::int AS count
         FROM job_postings WHERE ${ACTIVE_JOB}
        GROUP BY sector, subsector
        ORDER BY count DESC LIMIT 18`,
      baseArgs
    ),
    pgPool.query<{ key: string; count: number }>(
      `SELECT COALESCE(NULLIF(seniority_bucket, ''), '不限/其他') AS key, count(*)::int AS count
         FROM job_postings WHERE ${ACTIVE_JOB}
        GROUP BY key ORDER BY count DESC LIMIT 10`,
      baseArgs
    ),
    pgPool.query<{ key: string; count: number }>(
      `SELECT source AS key, count(*)::int AS count
         FROM job_postings WHERE ${ACTIVE_JOB}
        GROUP BY source ORDER BY count DESC LIMIT 12`,
      baseArgs
    ),
    pgPool.query<{ key: string; count: number; median_salary: string | null }>(
      `SELECT city AS key, count(*)::int AS count,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary
         FROM job_postings WHERE ${where}
        GROUP BY city ORDER BY count DESC LIMIT 12`,
      args
    ),
    pgPool.query<{ key: string; count: number; median_salary: string | null }>(
      `SELECT COALESCE(NULLIF(function_key, ''), '其他') AS key, count(*)::int AS count,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary
         FROM job_postings WHERE ${where}
        GROUP BY key ORDER BY count DESC LIMIT 12`,
      args
    ),
    pgPool.query<{ sector: string; subsector: string; count: number }>(
      `SELECT COALESCE(NULLIF(industry_sector, ''), '其他') AS sector,
              COALESCE(NULLIF(industry_subsector, ''), '其他') AS subsector,
              count(*)::int AS count
         FROM job_postings WHERE ${where}
        GROUP BY sector, subsector
        ORDER BY count DESC LIMIT 12`,
      args
    ),
    pgPool.query<{ key: string; count: number }>(
      `SELECT COALESCE(NULLIF(seniority_bucket, ''), '不限/其他') AS key, count(*)::int AS count
         FROM job_postings WHERE ${where}
        GROUP BY key ORDER BY count DESC LIMIT 10`,
      args
    ),
    pgPool.query<{ key: string; count: number }>(
      `SELECT COALESCE(NULLIF(salary_band, ''), '未披露') AS key, count(*)::int AS count
         FROM job_postings WHERE ${where}
        GROUP BY key ORDER BY count DESC LIMIT 8`,
      args
    ),
    pgPool.query<{ key: string; count: number }>(
      `SELECT skill AS key, count(*)::int AS count
         FROM job_postings
         CROSS JOIN LATERAL jsonb_array_elements_text(tags) AS skill
        WHERE ${where}
        GROUP BY skill
        ORDER BY count DESC LIMIT 15`,
      args
    ),
    pgPool.query<{
      snap_date: string;
      new_jobs: number;
      median_salary: string | null;
      avg_salary: number | null;
    }>(
      `SELECT fetched_at::date AS snap_date,
              count(*)::int AS new_jobs,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary,
              round(avg(LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)))::int AS avg_salary
         FROM job_postings
        WHERE ${where} AND fetched_at >= now() - ($${args.length + 1}::int || ' days')::interval
        GROUP BY snap_date
        ORDER BY snap_date`,
      [...args, range]
    ),
  ]);

  const summary = summaryRes.rows[0] ?? {
    total: 0,
    city_count: 0,
    avg_salary: null,
    median_salary: null,
    last_7_days_jobs: 0,
  };

  const legacy = isGlobal ? await analyzeMarket().catch(() => null) : null;
  if (legacy) {
    summary.avg_salary = legacy.overview?.avgSalary ?? summary.avg_salary;
    summary.median_salary = legacy.overview?.medianSalary == null ? null : String(legacy.overview.medianSalary);
  }

  const timeSeries = isGlobal
    ? await readGlobalMarketTimeSeries(range)
    : fillSeries(
        seriesRes.rows.map((row) => ({
          date: row.snap_date,
          newJobs: Number(row.new_jobs ?? 0),
          medianSalary: row.median_salary == null ? null : Number(row.median_salary),
          avgSalary: row.avg_salary == null ? null : Number(row.avg_salary),
        })),
        range
      );

  const facet = <T extends { key?: string; sector?: string; subsector?: string; count: number }>(
    rows: T[]
  ): MarketFacetItem[] =>
    rows.map((row) => ({
      key: row.sector && row.subsector ? `${row.sector} / ${row.subsector}` : String(row.key ?? "其他"),
      label: row.sector && row.subsector ? `${row.sector} / ${row.subsector}` : String(row.key ?? "其他"),
      count: Number(row.count),
    }));

  const rank = <T extends { key?: string; count: number; median_salary?: string | null }>(
    rows: T[]
  ): MarketRankItem[] =>
    rows.map((row) => ({
      key: String(row.key ?? "其他"),
      label: String(row.key ?? "其他"),
      count: Number(row.count),
      medianSalary: row.median_salary == null ? null : Number(row.median_salary),
    }));

  return {
    generatedAt: new Date().toISOString(),
    filters: normalized,
    summary: {
      total: Number(summary.total ?? 0),
      cityCount: Number(summary.city_count ?? 0),
      skillCount: Number(skillRes.rows[0]?.skill_count ?? 0),
      avgSalary: Number(summary.avg_salary ?? 0) || null,
      medianSalary: summary.median_salary == null ? null : Number(summary.median_salary),
      last7DaysJobs: Number(summary.last_7_days_jobs ?? 0),
    },
    facets: {
      cities: facet(cities.rows),
      functions: facet(functions.rows),
      industries: facet(industries.rows),
      seniorities: facet(seniorities.rows),
      sources: facet(sources.rows),
    },
    distributions: {
      byCity: rank(byCity.rows),
      byFunction: rank(byFunction.rows),
      byIndustry: byIndustry.rows.map((row) => ({
        sector: row.sector,
        subsector: row.subsector,
        count: Number(row.count),
      })),
      bySeniority: bySeniority.rows.map((row) => ({
        key: row.key,
        label: row.key,
        count: Number(row.count),
      })),
      bySalary: legacy
        ? legacy.salaryDist.map((item) => ({
            label: item.label,
            count: item.count,
          }))
        : bySalary.rows.map((row) => ({
            label: row.key,
            count: Number(row.count),
          })),
      bySkill: bySkill.rows.map((row) => ({
        key: row.key,
        label: row.key,
        count: Number(row.count),
      })),
    },
    timeSeries,
  };
}
