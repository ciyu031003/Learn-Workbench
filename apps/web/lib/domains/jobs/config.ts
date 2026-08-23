import { pgPool } from "@/lib/db";
import type { JobCategory, JobCrawlerConfig, JobSource } from "@learn-workbench/shared";
import { allJobCategories, defaultCrawlerConfig, defaultCrawlerPlatforms } from "@learn-workbench/shared";

export async function getCrawlerConfig(userId: string): Promise<JobCrawlerConfig> {
  const { rows } = await pgPool.query(
    `SELECT keywords, industries, cities, platforms, categories, provinces, sources,
            schedule_time, enabled, max_pages, last_run_at
       FROM job_crawler_configs WHERE user_id = $1`,
    [userId]
  );
  const r = rows[0];
  if (!r) return { ...defaultCrawlerConfig };
  const platforms = Array.isArray(r.platforms) ? r.platforms.map(String) : defaultCrawlerPlatforms;
  const categories = CATEGORY_FILTER(r.categories) as JobCategory[];
  return {
    keywords: parseArr(r.keywords),
    industries: parseArr(r.industries),
    cities: parseArr(r.cities),
    platforms: platforms.filter((p: string): p is JobSource => defaultCrawlerPlatforms.includes(p as JobSource) || p === "boss"),
    categories: categories.length > 0 ? categories : allJobCategories,
    provinces: parseArr(r.provinces),
    sources: parseArr(r.sources),
    scheduleTime: r.schedule_time ?? "08:00",
    enabled: !!r.enabled,
    maxPages: typeof r.max_pages === "number" ? r.max_pages : 3,
    lastRunAt: r.last_run_at ?? null,
  };
}
export async function saveCrawlerConfig(userId: string, cfg: JobCrawlerConfig): Promise<void> {
  await pgPool.query(
    `INSERT INTO job_crawler_configs
       (user_id, keywords, industries, cities, platforms, categories, provinces, sources,
        schedule_time, enabled, max_pages)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11)
     ON CONFLICT (user_id) DO UPDATE SET
       keywords = EXCLUDED.keywords, industries = EXCLUDED.industries,
       cities = EXCLUDED.cities, platforms = EXCLUDED.platforms,
       categories = EXCLUDED.categories, provinces = EXCLUDED.provinces,
       sources = EXCLUDED.sources,
       schedule_time = EXCLUDED.schedule_time, enabled = EXCLUDED.enabled,
       max_pages = EXCLUDED.max_pages`,
    [
      userId,
      JSON.stringify(cfg.keywords),
      JSON.stringify(cfg.industries),
      JSON.stringify(cfg.cities),
      JSON.stringify(cfg.platforms),
      JSON.stringify(cfg.categories ?? allJobCategories),
      JSON.stringify(cfg.provinces ?? []),
      JSON.stringify(cfg.sources ?? []),
      cfg.scheduleTime,
      cfg.enabled,
      cfg.maxPages,
    ]
  );
}
const parseArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const CATEGORY_FILTER = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v.map(String) : [];
  return list.filter((c) => allJobCategories.includes(c as never));
};
