import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { JobCrawlerConfig, JobLearningPlan, JobPostingListItem, JobRun, JobSource, JobStats, SkillGapItem } from "@learn-workbench/shared";

export type JobDetail = JobPostingListItem & {
  description: string;
  requirements: string;
  companyInfo: string;
  logoUrl: string;
  sourceJobId: string;
};

export interface JobListParams {
  q?: string;
  city?: string;
  category?: string;
  platforms?: JobSource[];
  sort?: "new" | "salary";
  page?: number;
  pageSize?: number;
  // P1 多条件筛选
  salaryMin?: number;
  salaryMax?: number;
  education?: string[];
  experience?: string[];
  publishedWithin?: "today" | "3d" | "7d";
  skills?: string[];
}

export interface JobListResult {
  jobs: JobPostingListItem[];
  total: number;
  page: number;
  pageSize: number;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = useAppStore.getState().token;
  if (token) headers.Authorization = "Bearer " + token;

  const r = await fetch(getApiUrl() + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await r.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  if (!r.ok) {
    const msg = typeof data.error === "string" ? data.error : "请求失败（" + r.status + "）";
    throw new Error(msg);
  }
  return data as T;
}

function buildJobListQuery(params: JobListParams): string {
  const parts: string[] = [];
  if (params.q?.trim()) parts.push("q=" + encodeURIComponent(params.q.trim()));
  if (params.city?.trim()) parts.push("city=" + encodeURIComponent(params.city.trim()));
  if (params.category?.trim()) parts.push("category=" + encodeURIComponent(params.category.trim()));
  if (params.platforms && params.platforms.length > 0) parts.push("platforms=" + encodeURIComponent(params.platforms.join(",")));
  if (params.sort) parts.push("sort=" + params.sort);
  if (typeof params.page === "number") parts.push("page=" + params.page);
  if (typeof params.pageSize === "number") parts.push("pageSize=" + params.pageSize);
  // P1 多条件筛选
  if (typeof params.salaryMin === "number") parts.push("salaryMin=" + params.salaryMin);
  if (typeof params.salaryMax === "number") parts.push("salaryMax=" + params.salaryMax);
  if (params.education && params.education.length > 0) parts.push("education=" + encodeURIComponent(params.education.join(",")));
  if (params.experience && params.experience.length > 0) parts.push("experience=" + encodeURIComponent(params.experience.join(",")));
  if (params.publishedWithin) parts.push("publishedWithin=" + params.publishedWithin);
  if (params.skills && params.skills.length > 0) parts.push("skills=" + encodeURIComponent(params.skills.join(",")));
  parts.push("includeSources=1");
  return parts.length > 0 ? "/api/jobs?" + parts.join("&") : "/api/jobs";
}

export async function fetchJobs(params: JobListParams = {}): Promise<JobListResult> {
  return apiRequest<JobListResult>(buildJobListQuery(params));
}

export async function fetchJobDetail(id: number | string): Promise<JobDetail> {
  const data = await apiRequest<{ job: JobDetail }>("/api/jobs/" + id);
  return data.job;
}

export async function toggleJobFavorite(id: number | string): Promise<boolean> {
  const data = await apiRequest<{ favorited: boolean }>("/api/jobs/" + id + "/favorite", { method: "POST" });
  return data.favorited;
}

export async function fetchJobStats(): Promise<JobStats> {
  return apiRequest<JobStats>("/api/jobs/stats");
}

export async function fetchJobConfig(): Promise<JobCrawlerConfig> {
  const data = await apiRequest<{ config: JobCrawlerConfig }>("/api/jobs/config");
  return data.config;
}

export async function saveJobConfig(config: JobCrawlerConfig): Promise<JobCrawlerConfig> {
  const data = await apiRequest<{ ok: boolean; config: JobCrawlerConfig }>("/api/jobs/config", {
    method: "PUT",
    body: { config },
  });
  return data.config;
}

export async function runCrawler(): Promise<boolean> {
  const data = await apiRequest<{ started: boolean }>("/api/jobs/run", { method: "POST" });
  return data.started;
}

export async function fetchJobRuns(): Promise<JobRun[]> {
  const data = await apiRequest<{ runs: JobRun[] }>("/api/jobs/runs");
  return data.runs ?? [];
}

/** 岗位学习计划（整包规划）：岗位信息 + 匹配度 + 按阶段分组的能力缺口计划 */
export async function fetchJobPlan(id: number | string): Promise<JobLearningPlan> {
  return apiRequest<JobLearningPlan>("/api/jobs/" + id + "/plan");
}

/** 缺口一键加入学习任务（生成 daily_tasks） */
export async function enrollJobGaps(gaps: Pick<SkillGapItem, "skill" | "topicId" | "estimateHours">[]): Promise<number> {
  const data = await apiRequest<{ ok: boolean; created: number }>("/api/jobs/gaps/enroll", {
    method: "POST",
    body: {
      gaps: gaps.map((g) => ({ skill: g.skill, topicId: g.topicId, hours: g.estimateHours })),
    },
  });
  return data.created ?? 0;
}
