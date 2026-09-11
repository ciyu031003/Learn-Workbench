import { pgPool } from "@/lib/db";
import type { MarketTimePoint } from "./intelligence";

export interface MarketDimensionSnapshot {
  snapDate: string;
  dimension: string;
  dimensionKey: string;
  metricName: string;
  metricValue: number;
  meta: Record<string, unknown>;
}

const ACTIVE_JOB = "is_active = true AND channel = 'job'";

function insertSnapshots(rows: MarketDimensionSnapshot[]): Promise<unknown> {
  if (!rows.length) return Promise.resolve();
  const values: unknown[] = [];
  const placeholders = rows.map((row) => {
    const base = values.length;
    values.push(
      row.snapDate,
      row.dimension,
      row.dimensionKey,
      row.metricName,
      row.metricValue,
      JSON.stringify(row.meta)
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb)`;
  });
  return pgPool.query(
    `INSERT INTO market_dimension_snapshots
      (snap_date, dimension, dimension_key, metric_name, metric_value, meta)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (snap_date, dimension, dimension_key, metric_name)
     DO UPDATE SET metric_value = EXCLUDED.metric_value,
                   meta = EXCLUDED.meta,
                   created_at = now()`,
    values
  );
}

export async function writeMarketDimensionSnapshots(
  snapDate = new Date().toISOString().slice(0, 10)
): Promise<number> {
  const global = await pgPool.query<{
    total_jobs: number;
    new_jobs: number;
    avg_salary: number | null;
    median_salary: string | null;
  }>(
    `SELECT count(*)::int AS total_jobs,
            count(*) FILTER (WHERE fetched_at::date = $1::date)::int AS new_jobs,
            round(avg(LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)))::int AS avg_salary,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary
       FROM job_postings
      WHERE ${ACTIVE_JOB}`,
    [snapDate]
  );
  const row = global.rows[0];
  const globalRows: MarketDimensionSnapshot[] = [
    { snapDate, dimension: "market", dimensionKey: "global", metricName: "total_jobs", metricValue: Number(row?.total_jobs ?? 0), meta: {} },
    { snapDate, dimension: "market", dimensionKey: "global", metricName: "new_jobs", metricValue: Number(row?.new_jobs ?? 0), meta: {} },
    { snapDate, dimension: "market", dimensionKey: "global", metricName: "avg_salary", metricValue: row?.avg_salary == null ? 0 : Number(row.avg_salary), meta: {} },
    { snapDate, dimension: "market", dimensionKey: "global", metricName: "median_salary", metricValue: row?.median_salary == null ? 0 : Number(row.median_salary), meta: {} },
  ];

  const dimensionRows: MarketDimensionSnapshot[] = [];
  const dimensionQueries: Array<{
    dimension: string;
    groupBy: string;
  }> = [
    { dimension: "function", groupBy: "COALESCE(NULLIF(function_key, ''), '其他')" },
    { dimension: "seniority", groupBy: "COALESCE(NULLIF(seniority_bucket, ''), '不限/其他')" },
    { dimension: "salary_band", groupBy: "COALESCE(NULLIF(salary_band, ''), '未披露')" },
    {
      dimension: "industry",
      groupBy: "COALESCE(NULLIF(industry_sector, ''), '其他') || ' / ' || COALESCE(NULLIF(industry_subsector, ''), '其他')",
    },
  ];
  for (const dimension of dimensionQueries) {
    const result = await pgPool.query<{ dimension_key: string; count: number; median_salary: string | null }>(
      `SELECT ${dimension.groupBy} AS dimension_key,
              count(*)::int AS count,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(NULLIF(COALESCE(salary_max, salary_min), 0) / 100.0, 80)) AS median_salary
         FROM job_postings
        WHERE ${ACTIVE_JOB}
        GROUP BY ${dimension.groupBy}`,
      []
    );
    dimensionRows.push(
      ...result.rows.map((item) => ({
        snapDate,
        dimension: dimension.dimension,
        dimensionKey: item.dimension_key,
        metricName: "job_count",
        metricValue: Number(item.count),
        meta: { medianSalary: item.median_salary == null ? null : Number(item.median_salary) },
      }))
    );
  }

  await insertSnapshots(globalRows);
  await insertSnapshots(dimensionRows);
  return globalRows.length + dimensionRows.length;
}

export function fillMarketSeries(
  rows: Array<Partial<Record<"date" | "newJobs" | "avgSalary" | "medianSalary", number | string | null>>>,
  range: number
): MarketTimePoint[] {
  const points = new Map(rows.map((row) => [String(row.date ?? ""), row]));
  const result: MarketTimePoint[] = [];
  const today = new Date();
  for (let offset = range - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    const date = current.toISOString().slice(0, 10);
    const matched = points.get(date);
    const toNumber = (value: unknown): number | null => {
      if (value == null || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    result.push({
      date,
      newJobs: Number(matched?.newJobs ?? 0),
      medianSalary: toNumber(matched?.medianSalary),
      avgSalary: toNumber(matched?.avgSalary),
    });
  }
  return result;
}

export async function readGlobalMarketTimeSeries(range: number): Promise<MarketTimePoint[]> {
  const { rows } = await pgPool.query<{
    snap_date: string;
    metric_name: string;
    metric_value: number;
  }>(
    `SELECT snap_date, metric_name, metric_value
       FROM market_dimension_snapshots
      WHERE dimension = 'market'
        AND dimension_key = 'global'
        AND metric_name IN ('new_jobs', 'avg_salary', 'median_salary')
        AND snap_date >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
      ORDER BY snap_date`,
    [range]
  );

  const byDate = new Map<string, Partial<Record<"newJobs" | "avgSalary" | "medianSalary", number>>>(
    rows.map((row) => [row.snap_date, {}])
  );
  for (const row of rows) {
    const point = byDate.get(row.snap_date);
    if (!point) continue;
    if (row.metric_name === "new_jobs") point.newJobs = Number(row.metric_value);
    if (row.metric_name === "avg_salary") point.avgSalary = Number(row.metric_value);
    if (row.metric_name === "median_salary") point.medianSalary = Number(row.metric_value);
  }
  return fillMarketSeries(Array.from(byDate.entries()).map(([date, point]) => ({ date, ...point })), range);
}
