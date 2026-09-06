import path from "node:path";
import { pgPool } from "@/lib/db";
import {
  acquireTaskLock,
  baseEnv,
  failTask,
  findRepoRoot,
  setTaskPid,
  spawnDetached,
} from "@/lib/tasks/runner";

/**
 * 招聘爬虫触发（共享逻辑）：
 * - 管理员手动触发（/api/jobs/run）与服务器每日 cron（/api/internal/cron）共用；
 * - task_runs 表级互斥锁：同 key 在 TTL 内只允许一个实例（cron 与手动撞车也安全）；
 * - detached 启动子进程，不阻塞 HTTP 响应。
 */
export type CrawlerScope = "all" | "official" | "internet";

export interface CrawlerEngineResult {
  name: string;
  started: boolean;
  runId?: number;
}

export async function triggerCrawlerJobs(
  startedBy: string,
  scope: CrawlerScope = "all"
): Promise<CrawlerEngineResult[]> {
  const repoRoot = findRepoRoot("scripts/jobs_official.mjs");
  const env = baseEnv();
  const tasks: { key: string; script: string; args: string[] }[] = [];
  if (scope === "all" || scope === "official") {
    tasks.push({ key: "crawler:official", script: path.join(repoRoot, "scripts", "jobs_official.mjs"), args: [] });
  }
  if (scope === "all" || scope === "internet") {
    const args: string[] = [];
    if (process.env.JOBS_LIMIT) args.push("--limit", process.env.JOBS_LIMIT);
    tasks.push({ key: "crawler:internet", script: path.join(repoRoot, "scripts", "jobs_browser.mjs"), args });
  }

  const engines: CrawlerEngineResult[] = [];
  for (const t of tasks) {
    const lock = await acquireTaskLock(t.key, startedBy);
    if (!lock.acquired) {
      engines.push({ name: t.key, started: false });
      continue;
    }
    const spawned = spawnDetached("node", [t.script, ...t.args], env);
    if (!spawned.ok) {
      await failTask(t.key, spawned.error ?? "spawn failed");
      engines.push({ name: t.key, started: false });
      continue;
    }
    await setTaskPid(lock.runId!, spawned.pid);
    engines.push({ name: t.key, started: true, runId: lock.runId });
  }
  return engines;
}

/** 幂等守卫：今天是否已有一次成功的抓取（cron 重复触发/补跑时直接跳过） */
export async function crawlerRanSuccessfullyToday(): Promise<boolean> {
  const { rows } = await pgPool.query<{ found: number }>(
    `SELECT 1 AS found FROM job_crawler_runs
     WHERE status = 'success' AND started_at >= CURRENT_DATE LIMIT 1`
  );
  return rows.length > 0;
}
