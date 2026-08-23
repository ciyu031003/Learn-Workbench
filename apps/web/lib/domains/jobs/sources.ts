import { pgPool } from "@/lib/db";
import type { JobSourceHealth, JobSourceInfo } from "@learn-workbench/shared";

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
