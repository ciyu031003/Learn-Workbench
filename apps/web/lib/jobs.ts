import { pgPool } from "@/lib/db";
import type {
  ExamEvent,
  JobCrawlerConfig,
  JobNotification,
  JobPosting,
  JobSource,
  JobSourceHealth,
  JobSourceInfo,
  JobSubscription,
} from "@learn-workbench/shared";
import type { JobCategory } from "@learn-workbench/shared";
import { allJobCategories, defaultCrawlerConfig, defaultCrawlerPlatforms } from "@learn-workbench/shared";

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
  category: string;
  channel: string;
  deadline_at: string | null;
  extra: unknown;
  published_at: string | null;
  fetched_at: string;
}

export const JOB_CARD_SELECT = `
  id, source, source_job_id, title, company, city, district,
  salary_min, salary_max, salary_text, experience, education, tags,
  description, requirements, company_info, url, logo_url,
  category, channel, deadline_at, extra, published_at, fetched_at
`;

export function jobRowToPosting(row: JobRow): JobPosting {
  return {
    id: row.id,
    source: row.source,
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
    category: row.category || "internet",
    channel: row.channel === "announcement" || row.channel === "event" ? row.channel : "job",
    deadlineAt: row.deadline_at ?? null,
    extra: row.extra && typeof row.extra === "object" ? (row.extra as Record<string, unknown>) : {},
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
  };
}

const parseArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

const CATEGORY_FILTER = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v.map(String) : [];
  return list.filter((c) => allJobCategories.includes(c as never));
};

/** 读取当前账号的爬虫配置（无则返回默认值，不落库） */
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

/** 保存当前账号的爬虫配置（upsert，按 user_id 隔离） */
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

export interface JobListQuery {
  q?: string;
  city?: string;
  category?: string;
  categories?: string[];
  channels?: string[];
  platforms?: string[];
  provinces?: string[];
  sort?: string;
  page: number;
  pageSize: number;
  userId?: string | null; // 传了则查询该用户的收藏状态
  favOnly?: boolean;      // 只看收藏
  // ---- P1 多条件筛选 ----
  salaryMin?: number;        // 薪资下限（K）
  salaryMax?: number;        // 薪资上限（K）
  education?: string[];      // 学历多选
  experience?: string[];     // 经验多选
  publishedWithin?: "today" | "3d" | "7d";  // 发布时间窗口
  skills?: string[];         // 技能标签多选（匹配 tags）
  includeSources?: boolean;  // 附带聚类来源聚合
}

export interface JobListResult {
  jobs: Array<JobPosting & { isNew: boolean; isFav: boolean }>;
  total: number;
}

/** 职位列表查询（全局职位库；收藏状态按当前用户隔离） */
export async function queryJobs(params: JobListQuery): Promise<JobListResult> {
  const where: string[] = ["is_active = true"];
  const args: unknown[] = [];
  const {
    q, city, category, categories, channels, platforms, provinces, sort, page, pageSize, userId, favOnly,
    salaryMin, salaryMax, education, experience, publishedWithin, skills, includeSources,
  } = params;

  if (q) {
    args.push(`%${q}%`);
    where.push(`(title ILIKE $${args.length} OR company ILIKE $${args.length} OR tags::text ILIKE $${args.length})`);
  }
  if (city) {
    args.push(city);
    where.push(`city = $${args.length}`);
  }
  // ---- P1 多条件筛选 ----
  if (typeof salaryMin === "number") {
    args.push(salaryMin);
    where.push(`COALESCE(salary_min, 0) >= $${args.length}`);
  }
  if (typeof salaryMax === "number") {
    args.push(salaryMax);
    where.push(`COALESCE(salary_max, salary_min, 0) <= $${args.length}`);
  }
  if (education && education.length > 0) {
    args.push(education);
    where.push(`education = ANY($${args.length}::text[])`);
  }
  if (experience && experience.length > 0) {
    args.push(experience);
    where.push(`experience = ANY($${args.length}::text[])`);
  }
  if (publishedWithin === "today") {
    where.push(`fetched_at >= now() - interval '24 hours'`);
  } else if (publishedWithin === "3d") {
    where.push(`fetched_at >= now() - interval '3 days'`);
  } else if (publishedWithin === "7d") {
    where.push(`fetched_at >= now() - interval '7 days'`);
  }
  if (skills && skills.length > 0) {
    args.push(skills);
    where.push(`tags ?| $${args.length}::text[]`);
  }
  if (category) {
    args.push(category);
    where.push(`category = $${args.length}`);
  }
  if (categories && categories.length > 0) {
    args.push(categories);
    where.push(`category = ANY($${args.length}::text[])`);
  }
  if (channels && channels.length > 0) {
    args.push(channels);
    where.push(`channel = ANY($${args.length}::text[])`);
  }
  if (platforms && platforms.length > 0) {
    args.push(platforms);
    where.push(`source = ANY($${args.length}::text[])`);
  }
  if (provinces && provinces.length > 0) {
    args.push(provinces);
    where.push(`(city = ANY($${args.length}::text[]) OR district = ANY($${args.length}::text[]))`);
  }
  if (favOnly && userId) {
    args.push(userId);
    where.push(`EXISTS (SELECT 1 FROM job_favorites f WHERE f.user_id = $${args.length} AND f.job_id = job_postings.id)`);
  }

  let order: string;
  if (sort === "salary") {
    order = "salary_max DESC NULLS LAST, fetched_at DESC";
  } else if (sort === "deadline") {
    order = "deadline_at ASC NULLS LAST, fetched_at DESC";
  } else {
    order = "fetched_at DESC, id DESC";
  }
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

  let jobs = rows.map((r) => ({
    ...jobRowToPosting(r as JobRow),
    isNew: !!r.is_new,
    isFav: !!r.is_fav,
  }));

  // P1：附带聚类来源聚合（「发现来源：BOSS/猎聘/智联」）
  if (includeSources && jobs.length > 0) {
    const { jobClusterSources } = await import("@/lib/job-clusters");
    const sources = await jobClusterSources(jobs.map((j) => j.id));
    jobs = jobs.map((j) => {
      const list = sources[j.id];
      return list && list.length > 1 ? { ...j, clusterSources: list } : j;
    });
  }

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

/* ================= 信息源注册表（hosts 落库） ================= */

export async function listJobSources(): Promise<JobSourceInfo[]> {
  const { rows } = await pgPool.query(
    `SELECT id, category, channel, name, engine, base_url, risk, enabled,
            hit_rate, last_run_at, last_error, note
       FROM job_crawler_sources
      ORDER BY enabled DESC, category, id`
  );
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    channel: r.channel,
    name: r.name,
    engine: r.engine,
    baseUrl: r.base_url,
    risk: r.risk,
    enabled: !!r.enabled,
    hitRate: r.hit_rate == null ? 1 : Number(r.hit_rate),
    lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
    lastError: r.last_error ?? "",
    note: r.note ?? "",
  }));
}

export async function getHostsMeta(): Promise<{ version: number; updatedAt: string | null } | null> {
  const { rows } = await pgPool.query(
    `SELECT value->>'version' AS version, value->>'updated_at' AS updated_at
       FROM app_meta WHERE key = 'job_hosts'`
  );
  const r = rows[0];
  if (!r) return null;
  return {
    version: Number(r.version || 0),
    updatedAt: r.updated_at ?? null,
  };
}

export async function sourceHealth(source?: string, limit = 14): Promise<JobSourceHealth[]> {
  const args: unknown[] = [limit];
  let where = "";
  if (source) {
    args.push(source);
    where = "WHERE source = $" + args.length;
  }
  const { rows } = await pgPool.query(
    `SELECT id, source, fetched, hit_rate, error, created_at
       FROM job_source_health ${where}
      ORDER BY created_at DESC LIMIT $1`,
    args
  );
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    fetched: r.fetched,
    hitRate: Number(r.hit_rate || 0),
    error: r.error ?? "",
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
/* ================= 订阅 ================= */

export async function listSubscriptions(userId: string): Promise<JobSubscription[]> {
  const { rows } = await pgPool.query(
    `SELECT id, name, categories, keywords, cities, enabled, created_at
       FROM job_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categories: Array.isArray(r.categories) ? r.categories : [],
    keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
    cities: Array.isArray(r.cities) ? r.cities.map(String) : [],
    enabled: !!r.enabled,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function saveSubscription(
  userId: string,
  sub: Omit<JobSubscription, "id" | "createdAt"> & { id?: number }
): Promise<JobSubscription> {
  const name = (sub.name || "").trim() || "我的订阅";
  const categories = Array.isArray(sub.categories) ? sub.categories : [];
  const keywords = Array.isArray(sub.keywords) ? sub.keywords : [];
  const cities = Array.isArray(sub.cities) ? sub.cities : [];
  const { rows } = await pgPool.query(
    `INSERT INTO job_subscriptions (id, user_id, name, categories, keywords, cities, enabled)
     VALUES (COALESCE($1, nextval('job_subscriptions_id_seq'::regclass)), $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, categories = EXCLUDED.categories, keywords = EXCLUDED.keywords,
       cities = EXCLUDED.cities, enabled = EXCLUDED.enabled, updated_at = now()
     RETURNING id, name, categories, keywords, cities, enabled, created_at`,
    [sub.id ?? null, userId, name, JSON.stringify(categories), JSON.stringify(keywords), JSON.stringify(cities), sub.enabled]
  );
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    categories: Array.isArray(r.categories) ? r.categories : [],
    keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
    cities: Array.isArray(r.cities) ? r.cities.map(String) : [],
    enabled: !!r.enabled,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function deleteSubscription(userId: string, id: number): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    "DELETE FROM job_subscriptions WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

/* ================= 站内通知 ================= */

export async function listNotifications(userId: string, unreadOnly = false, limit = 30): Promise<JobNotification[]> {
  const args: unknown[] = [userId, limit];
  let where = "user_id = $1";
  if (unreadOnly) where += " AND read_at IS NULL";
  const { rows } = await pgPool.query(
    `SELECT id, job_id, subscription_id, title, body, url, read_at, created_at
       FROM job_notifications
      WHERE ${where}
      ORDER BY created_at DESC LIMIT $2`,
    args
  );
  return rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    subscriptionId: r.subscription_id ?? null,
    title: r.title,
    body: r.body ?? "",
    url: r.url ?? "",
    read: !!r.read_at,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  const { rows } = await pgPool.query(
    "SELECT count(*)::int AS n FROM job_notifications WHERE user_id = $1 AND read_at IS NULL",
    [userId]
  );
  return rows[0]?.n ?? 0;
}

export async function markNotificationRead(userId: string, id: number): Promise<void> {
  await pgPool.query(
    "UPDATE job_notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
    [id, userId]
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await pgPool.query(
    "UPDATE job_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL",
    [userId]
  );
}

/* ================= 考试日历 ================= */

export async function listUpcomingExamEvents(limit = 30): Promise<ExamEvent[]> {
  const { rows } = await pgPool.query(
    `SELECT e.id, e.job_id, e.kind, e.label, e.event_at, e.note,
            j.title, j.source, j.url
       FROM job_exam_events e
       JOIN job_postings j ON j.id = e.job_id
      WHERE e.event_at >= now() - interval '1 day'
      ORDER BY e.event_at ASC
      LIMIT $1`,
    [limit]
  );
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    kind: r.kind,
    label: r.label,
    eventAt: new Date(r.event_at).toISOString(),
    note: r.note ?? "",
    daysLeft: Math.max(0, Math.round((new Date(r.event_at).getTime() - now) / 86400000)),
    title: r.title ?? "",
    source: r.source ?? "",
    url: r.url ?? "",
  }));
}
