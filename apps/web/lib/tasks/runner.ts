import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pgPool } from "@/lib/db";

/* ============================================================================
 * P0：后台任务运行器（收敛 jobs/run、hosts/update 等处的 spawn 样板）
 * - DB 级任务互斥锁（task_runs）：同 key 在 TTL 内只允许一个实例
 * - detached 启动 + unref，不阻塞 HTTP 响应
 * ==========================================================================*/

export interface TaskEnv {
  [key: string]: string | undefined;
}

/** 向上查找仓库根（以存在 marker 文件为准） */
export function findRepoRoot(marker: string): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "..", "..")];
  for (const c of candidates) {
    if (existsSync(path.join(c, marker))) return c;
  }
  return path.resolve(cwd, "..", "..");
}

/** 爬虫/脚本运行所需环境变量（与历史行为一致，默认连本机 PostgreSQL） */
export function baseEnv(): TaskEnv {
  return {
    ...process.env,
    PGHOST: process.env.PGHOST || "127.0.0.1",
    PGPORT: process.env.PGPORT || "5432",
    PGDATABASE: process.env.PGDATABASE || "Learn-Workbench",
    PGUSER: process.env.PGUSER || "postgres",
    PGPASSWORD: process.env.PGPASSWORD || "",
    PSQL_BIN: process.env.PSQL_BIN || "",
  };
}

export interface SpawnResult {
  ok: boolean;
  pid?: number;
  error?: string;
}

/** 启动独立后台进程（detached），不等待结果 */
export function spawnDetached(
  executable: string,
  args: string[],
  env: TaskEnv
): SpawnResult {
  try {
    const child = spawn(executable, args, {
      env: env as NodeJS.ProcessEnv,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { ok: true, pid: child.pid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface TaskLockResult {
  acquired: boolean;
  runId?: number;
  retryAfterSeconds?: number;
}

/** 获取任务互斥锁；TTL 内同 key 任务已在运行则失败 */
export async function acquireTaskLock(
  taskKey: string,
  startedBy: string,
  ttlMs = 30 * 60_000
): Promise<TaskLockResult> {
  const { rows } = await pgPool.query<{ id: number }>(
    `INSERT INTO task_runs (task_key, status, started_by, started_at, updated_at)
     VALUES ($1, 'running', $2, now(), now())
     ON CONFLICT (task_key) DO UPDATE SET
       status = 'running', started_by = EXCLUDED.started_by, started_at = now(),
       updated_at = now(), finished_at = NULL, error = NULL
       WHERE task_runs.updated_at < now() - make_interval(secs => $3)
     RETURNING id`,
    [taskKey, startedBy, Math.floor(ttlMs / 1000)]
  );
  if (rows[0]) return { acquired: true, runId: rows[0].id };
  const { rows: cur } = await pgPool.query<{ updated_at: Date }>(
    `SELECT updated_at FROM task_runs WHERE task_key = $1`,
    [taskKey]
  );
  const last = cur[0]?.updated_at ? new Date(cur[0].updated_at).getTime() : Date.now();
  return { acquired: false, retryAfterSeconds: Math.max(1, Math.ceil((last + ttlMs - Date.now()) / 1000)) };
}

export async function setTaskPid(runId: number, pid?: number): Promise<void> {
  await pgPool.query(`UPDATE task_runs SET pid = $2 WHERE id = $1`, [runId, pid ?? null]);
}

export async function failTask(taskKey: string, error?: string): Promise<void> {
  await pgPool.query(
    `UPDATE task_runs SET status = 'failed', error = $2, finished_at = now(), updated_at = now()
     WHERE task_key = $1`,
    [taskKey, error ?? null]
  );
}