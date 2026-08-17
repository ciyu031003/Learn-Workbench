import { pgPool } from "@/lib/db";
import type { JobCrawlerConfig, JobPosting, JobSource } from "@learn-workbench/shared";
import { defaultCrawlerConfig, defaultCrawlerPlatforms } from "@learn-workbench/shared";

export interface JobRow {
  id: number;
  source: string;
  source_job_id: string;
  title: string;
  company: string;
  city: string;
  district: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_text: string;
  experience: string;
  education: string;
  tags: unknown;
  description: string;
  requirements: string;
  company_info: string;
  url: string;
  logo_url: string;
  published_at: string | null;
  fetched_at: string;
}

export const JOB_CARD_SELECT = `
  id, source, source_job_id, title, company, city, district,
  salary_min, salary_max, salary_text, experience, education, tags,
  description, requirements, company_info, url, logo_url, published_at, fetched_at
`;

export function jobRowToPosting(row: JobRow): JobPosting {
  return {
    id: row.id,
    source: row.source as JobSource,
    sourceJobId: row.source_job_id,
    title: row.title,
    company: row.company,
    city: row.city,
    district: row.district,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryText: row.salary_text,
    experience: row.experience,
    education: row.education,
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: row.description,
    requirements: row.requirements,
    companyInfo: row.company_info,
    url: row.url,
    logoUrl: row.logo_url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
  };
}

const parseArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** 读取当前账号的爬虫配置（无则返回默认值，不落库） */
export async function getCrawlerConfig(userId: string): Promise<JobCrawlerConfig> {
  const { rows } = await pgPool.query(
    `SELECT keywords, industries, cities, platforms, schedule_time, enabled, max_pages, last_run_at
       FROM job_crawler_configs WHERE user_id = $1`,
    [userId]
  );
  const r = rows[0];
  if (!r) return { ...defaultCrawlerConfig };
  const platforms = Array.isArray(r.platforms) ? r.platforms.map(String) : defaultCrawlerPlatforms;
  return {
    keywords: parseArr(r.keywords),
    industries: parseArr(r.industries),
    cities: parseArr(r.cities),
    platforms: platforms.filter((p: string): p is JobSource => defaultCrawlerPlatforms.includes(p as JobSource) || p === "boss"),
    scheduleTime: r.schedule_time ?? "08:00",
    enabled: !!r.enabled,
    maxPages: typeof r.max_pages === "number" ? r.max_pages : 3,
    lastRunAt: r.last_run_at ?? null,
  };
}

/** 保存当前账号的爬虫配置（upsert，按 user_id 隔离） */
export async function saveCrawlerConfig(userId: string, cfg: JobCrawlerConfig): Promise<void> {
  await pgPool.query(
    `INSERT INTO job_crawler_configs
       (user_id, keywords, industries, cities, platforms, schedule_time, enabled, max_pages)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET
       keywords = EXCLUDED.keywords, industries = EXCLUDED.industries,
       cities = EXCLUDED.cities, platforms = EXCLUDED.platforms,
       schedule_time = EXCLUDED.schedule_time, enabled = EXCLUDED.enabled,
       max_pages = EXCLUDED.max_pages`,
    [
      userId,
      JSON.stringify(cfg.keywords),
      JSON.stringify(cfg.industries),
      JSON.stringify(cfg.cities),
      JSON.stringify(cfg.platforms),
      cfg.scheduleTime,
      cfg.enabled,
      cfg.maxPages,
    ]
  );
}

export interface JobListQuery {
  q?: string;
  city?: string;
  platforms?: string[];
  sort?: string;
  page: number;
  pageSize: number;
  userId?: string | null; // 传了则查询该用户的收藏状态
  favOnly?: boolean;      // 只看收藏
}

export interface JobListResult {
  jobs: Array<JobPosting & { isNew: boolean; isFav: boolean }>;
  total: number;
}

/** 职位列表查询（全局职位库；收藏状态按当前用户隔离） */
export async function queryJobs(params: JobListQuery): Promise<JobListResult> {
  const where: string[] = ["is_active = true"];
  const args: unknown[] = [];
  const { q, city, platforms, sort, page, pageSize, userId, favOnly } = params;

  if (q) {
    args.push(`%${q}%`);
    where.push(`(title ILIKE $${args.length} OR company ILIKE $${args.length} OR tags::text ILIKE $${args.length})`);
  }
  if (city) {
    args.push(city);
    where.push(`city = $${args.length}`);
  }
  if (platforms && platforms.length > 0) {
    args.push(platforms);
    where.push(`source = ANY($${args.length}::text[])`);
  }
  if (favOnly && userId) {
    args.push(userId);
    where.push(`EXISTS (SELECT 1 FROM job_favorites f WHERE f.user_id = $${args.length} AND f.job_id = job_postings.id)`);
  }

  const order = sort === "salary" ? "salary_max DESC NULLS LAST, fetched_at DESC" : "fetched_at DESC, id DESC";
  const favSelect = userId
    ? `(SELECT EXISTS(SELECT 1 FROM job_favorites f WHERE f.user_id = $${args.length + 1} AND f.job_id = job_postings.id))`
    : "false";

  const whereSql = where.join(" AND ");
  const offset = (page - 1) * pageSize;

  const listParams = userId ? [...args, userId, pageSize, offset] : [...args, pageSize, offset];
  const { rows } = await pgPool.query(
    `SELECT ${JOB_CARD_SELECT}, ${favSelect} AS is_fav,
            (fetched_at >= now() - interval '24 hours') AS is_new
       FROM job_postings
      WHERE ${whereSql}
      ORDER BY ${order}
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const totalParams = favOnly && userId ? [...args, userId] : args;
  const { rows: cnt } = await pgPool.query(
    `SELECT count(*)::int AS n FROM job_postings
      WHERE ${whereSql} ${favOnly && userId ? `AND EXISTS (SELECT 1 FROM job_favorites f WHERE f.user_id = $${totalParams.length} AND f.job_id = job_postings.id)` : ""}`,
    totalParams
  );

  const jobs = rows.map((r) => ({
    ...jobRowToPosting(r as JobRow),
    isNew: !!r.is_new,
    isFav: !!r.is_fav,
  }));
  return { jobs, total: cnt[0]?.n ?? 0 };
}

/** 获取单个职位详情 + 当前用户收藏状态 */
export async function getJobDetail(id: number, userId: string | null): Promise<(JobPosting & { isFav: boolean }) | null> {
  const { rows } = await pgPool.query(
    `SELECT ${JOB_CARD_SELECT},
            CASE WHEN $2::uuid IS NOT NULL THEN
              EXISTS(SELECT 1 FROM job_favorites f WHERE f.user_id = $2 AND f.job_id = job_postings.id)
            ELSE false END AS is_fav
       FROM job_postings WHERE id = $1 AND is_active = true`,
    [id, userId]
  );
  if (!rows[0]) return null;
  const row = rows[0] as JobRow & { is_fav: boolean };
  return { ...jobRowToPosting(row), isFav: !!row.is_fav };
}
