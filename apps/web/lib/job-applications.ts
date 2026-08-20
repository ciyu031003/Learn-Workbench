import { pgPool } from "@/lib/db";
import type { JobApplication, JobApplicationStage, JobApplicationStats } from "@learn-workbench/shared";
import { jobApplicationStageLabels, jobApplicationStageSchema } from "@learn-workbench/shared";

const APP_SELECT = `
  a.id, a.job_id, a.stage, a.note, a.applied_at, a.updated_at,
  j.title AS job_title, j.company AS job_company, j.city AS job_city,
  COALESCE(j.salary_text, '') AS job_salary, j.url AS job_url, j.source AS job_source
`;

const APP_JOIN = `
  FROM job_applications a
  JOIN job_postings j ON j.id = a.job_id
`;

function rowToApp(r: Record<string, unknown>): JobApplication {
  const stage = jobApplicationStageSchema.safeParse(r.stage);
  return {
    id: Number(r.id),
    jobId: Number(r.job_id),
    stage: stage.success ? stage.data : "favorite",
    note: String(r.note ?? ""),
    appliedAt: r.applied_at ? new Date(r.applied_at as string).toISOString() : null,
    updatedAt: new Date(r.updated_at as string).toISOString(),
    jobTitle: String(r.job_title ?? ""),
    jobCompany: String(r.job_company ?? ""),
    jobCity: String(r.job_city ?? ""),
    jobSalary: String(r.job_salary ?? ""),
    jobUrl: String(r.job_url ?? ""),
    jobSource: String(r.job_source ?? ""),
  };
}

/** 求职列表（按 updated_at 倒序） */
export async function listApplications(userId: string): Promise<JobApplication[]> {
  const { rows } = await pgPool.query(
    `SELECT ${APP_SELECT} ${APP_JOIN} WHERE a.user_id = $1 ORDER BY a.updated_at DESC`,
    [userId]
  );
  return rows.map((r) => rowToApp(r as Record<string, unknown>));
}

/** 加入求职（upsert：同一职位再次加入则更新阶段/时间） */
export async function addApplication(
  userId: string,
  jobId: number,
  stage: JobApplicationStage = "favorite"
): Promise<JobApplication> {
  const { rows } = await pgPool.query(
    `INSERT INTO job_applications (user_id, job_id, stage, applied_at)
     VALUES ($1, $2, $3, CASE WHEN $3 IN ('applied','online_test','interview1','interview2','offer','hired') THEN now() ELSE NULL END)
     ON CONFLICT (user_id, job_id) DO UPDATE SET
       stage = EXCLUDED.stage,
       applied_at = COALESCE(job_applications.applied_at, EXCLUDED.applied_at),
       updated_at = now()
     RETURNING id, job_id, stage, note, applied_at, updated_at`,
    [userId, jobId, stage]
  );
  const r = rows[0];
  const detail = await pgPool.query(
    `SELECT title AS job_title, company AS job_company, city AS job_city,
            COALESCE(salary_text,'') AS job_salary, url AS job_url, source AS job_source
       FROM job_postings WHERE id = $1`,
    [jobId]
  );
  const d = detail.rows[0] ?? {};
  return {
    id: Number(r.id),
    jobId: Number(r.job_id),
    stage: stage,
    note: "",
    appliedAt: r.applied_at ? new Date(r.applied_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
    jobTitle: String(d.job_title ?? ""),
    jobCompany: String(d.job_company ?? ""),
    jobCity: String(d.job_city ?? ""),
    jobSalary: String(d.job_salary ?? ""),
    jobUrl: String(d.job_url ?? ""),
    jobSource: String(d.job_source ?? ""),
  };
}

/** 更新阶段（同 stage 则仅更新时间） */
export async function updateApplicationStage(
  userId: string,
  id: number,
  stage: JobApplicationStage,
  note?: string
): Promise<JobApplication | null> {
  const sets: string[] = ["updated_at = now()"];
  const params: (string | number)[] = [stage];
  sets.push("stage = $" + params.length);
  if (typeof note === "string") {
    params.push(note);
    sets.push("note = $" + params.length);
  }
  params.push(id, userId);
  const { rows } = await pgPool.query(
    `UPDATE job_applications SET ${sets.join(", ")} WHERE id = $${params.length - 1} AND user_id = $${params.length} RETURNING id, job_id, stage, note, applied_at, updated_at`,
    params
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const detail = await pgPool.query(
    `SELECT title AS job_title, company AS job_company, city AS job_city,
            COALESCE(salary_text,'') AS job_salary, url AS job_url, source AS job_source
       FROM job_postings WHERE id = $1`,
    [r.job_id]
  );
  const d = detail.rows[0] ?? {};
  return {
    id: Number(r.id),
    jobId: Number(r.job_id),
    stage: stage,
    note: String(r.note ?? ""),
    appliedAt: r.applied_at ? new Date(r.applied_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
    jobTitle: String(d.job_title ?? ""),
    jobCompany: String(d.job_company ?? ""),
    jobCity: String(d.job_city ?? ""),
    jobSalary: String(d.job_salary ?? ""),
    jobUrl: String(d.job_url ?? ""),
    jobSource: String(d.job_source ?? ""),
  };
}

/** 删除求职记录 */
export async function deleteApplication(userId: string, id: number): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    "DELETE FROM job_applications WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

/** 求职统计（各阶段数量 + Kanban 四列） */
export async function applicationStats(userId: string): Promise<JobApplicationStats> {
  const { rows } = await pgPool.query<{ stage: string; n: number }>(
    "SELECT stage, count(*)::int AS n FROM job_applications WHERE user_id = $1 GROUP BY stage",
    [userId]
  );
  const stats = {} as JobApplicationStats;
  for (const s of jobApplicationStageSchema.options) stats[s] = 0;
  for (const r of rows) {
    const s = jobApplicationStageSchema.safeParse(r.stage);
    if (s.success) stats[s.data] = r.n;
  }
  return stats;
}

/** 该用户是否已把某职位加入求职 */
export async function getApplicationByJob(userId: string, jobId: number): Promise<JobApplication | null> {
  const { rows } = await pgPool.query(
    `SELECT ${APP_SELECT} ${APP_JOIN} WHERE a.user_id = $1 AND a.job_id = $2 LIMIT 1`,
    [userId, jobId]
  );
  return rows[0] ? rowToApp(rows[0] as Record<string, unknown>) : null;
}
