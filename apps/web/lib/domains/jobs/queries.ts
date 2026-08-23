import { pgPool } from "@/lib/db";
import type { JobPosting } from "@learn-workbench/shared";

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
