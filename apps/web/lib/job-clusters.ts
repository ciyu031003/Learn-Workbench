import { pgPool } from "@/lib/db";
import { jobDedupKey } from "@learn-workbench/shared";

/**
 * 招花 P1 · 职位去重聚类
 * 按 规范化标题|规范化公司|城市 聚合 job_postings → job_clusters。
 * 增量执行：只处理最近 N 天抓取的职位，不阻塞抓取流程。
 */
export async function runJobClustering(lookbackDays = 7): Promise<{ clusters: number; merged: number }> {
  const { rows } = await pgPool.query<{
    id: number; title: string; company: string; city: string; source: string;
    published_at: string | null; fetched_at: string;
  }>(
    `SELECT id, title, company, city, source, published_at, fetched_at
       FROM job_postings
      WHERE is_active = true AND fetched_at >= now() - ($1 || ' days')::interval`,
    [lookbackDays]
  );

  // 按 dedup_key 分组
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = jobDedupKey(row.title, row.company, row.city);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let clusters = 0;
  let merged = 0;
  for (const [key, members] of groups) {
    if (members.length < 2) continue; // 单个职位不聚类
    // 代表职位：fetched_at 最新的
    const primary = [...members].sort(
      (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
    )[0];
    const jobIds = members.map((m) => m.id);
    const sources = Array.from(new Set(members.map((m) => m.source))).sort();
    const city = primary.city ?? "";
    await pgPool.query(
      `INSERT INTO job_clusters (canonical_title, canonical_company, city, dedup_key, job_ids, source_list, primary_job_id, member_count)
       VALUES ($1, $2, $3, $4, $5::bigint[], $6::jsonb, $7, $8)
       ON CONFLICT (dedup_key) DO UPDATE SET
         job_ids = EXCLUDED.job_ids,
         source_list = EXCLUDED.source_list,
         primary_job_id = EXCLUDED.primary_job_id,
         member_count = EXCLUDED.member_count,
         updated_at = now()`,
      [
        primary.title, primary.company, city, key,
        jobIds, JSON.stringify(sources), primary.id, members.length,
      ]
    );
    clusters += 1;
    merged += members.length;
  }
  return { clusters, merged };
}

/** 查询职位所属簇的来源聚合（用于卡片展示「发现来源：猎聘/智联」） */
export async function jobClusterSources(jobIds: number[]): Promise<Record<number, string[]>> {
  if (jobIds.length === 0) return {};
  const { rows } = await pgPool.query<{ job_ids: number[]; source_list: string[] }>(
    `SELECT job_ids, source_list FROM job_clusters
      WHERE job_ids && $1::bigint[]`,
    [jobIds]
  );
  const map: Record<number, string[]> = {};
  for (const r of rows) {
    for (const id of r.job_ids) {
      if (jobIds.includes(id)) map[id] = r.source_list ?? [];
    }
  }
  return map;
}
