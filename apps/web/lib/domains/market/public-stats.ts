import { pgPool } from "@/lib/db";

/**
 * 公开统计（落地页实时数据，无需登录）：
 * - 正常路径：每日 aggregate 任务预计算后写入 market_stats(key='public')，
 *   用户请求只做主键单行读，多用户并发不再是全表聚合；
 * - 兜底路径：快照缺失/过期时实时聚合并回填（冷启动/聚合任务未跑时不 503）。
 */

export interface PublicStats {
  total: number;
  todayNew: number;
  cityCount: number;
  platformCount: number;
  avgSalary: number | null;
  fetchedAt: string | null;
}

const CACHE_KEY = "public";
// 26h：覆盖「今日 05:40 聚合 → 明日 05:40 再聚合」的间隔并留漂移余量
const STATS_TTL_MS = 26 * 3600_000;

/** 实时聚合（兜底路径） */
export async function computePublicStats(): Promise<PublicStats> {
  const { rows } = await pgPool.query(
    "SELECT " +
      "(SELECT count(*)::int FROM job_postings WHERE is_active = true) AS total, " +
      "(SELECT count(*)::int FROM job_postings WHERE is_active = true AND fetched_at >= now() - interval '24 hours') AS today_new, " +
      "(SELECT count(DISTINCT city)::int FROM job_postings WHERE is_active = true) AS city_count, " +
      "(SELECT count(DISTINCT source)::int FROM job_postings WHERE is_active = true) AS platform_count, " +
      "(SELECT round(avg((salary_min + salary_max) / 2.0))::int FROM job_postings WHERE is_active = true AND salary_min > 0 AND salary_max > 0) AS avg_salary, " +
      "(SELECT max(fetched_at) FROM job_postings WHERE is_active = true) AS fetched_at"
  );
  const r = rows[0] ?? {};
  return {
    total: r.total ?? 0,
    todayNew: r.today_new ?? 0,
    cityCount: r.city_count ?? 0,
    platformCount: r.platform_count ?? 0,
    avgSalary: r.avg_salary ?? null,
    fetchedAt: r.fetched_at ? new Date(r.fetched_at).toISOString() : null,
  };
}

/** 预聚合快照写入（每日 aggregate 任务调用） */
export async function refreshPublicStatsCache(stats: PublicStats): Promise<void> {
  await pgPool.query(
    `INSERT INTO market_stats (key, payload, computed_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [CACHE_KEY, JSON.stringify(stats)]
  );
}

/** 读公开统计：优先当日预聚合快照（单行读）；无快照时实时计算并回填 */
export async function getPublicStats(): Promise<PublicStats> {
  const cached = await pgPool.query<{ payload: PublicStats; computed_at: Date }>(
    `SELECT payload, computed_at FROM market_stats WHERE key = $1`,
    [CACHE_KEY]
  );
  const row = cached.rows[0];
  if (row?.payload && Date.now() - new Date(row.computed_at).getTime() < STATS_TTL_MS) {
    return row.payload;
  }
  const stats = await computePublicStats();
  await refreshPublicStatsCache(stats).catch(() => {});
  return stats;
}

/** 强制重算并写快照（每日 aggregate 任务调用） */
export async function refreshPublicStats(): Promise<PublicStats> {
  const stats = await computePublicStats();
  await refreshPublicStatsCache(stats);
  return stats;
}
