import path from "node:path";
import { pgPool } from "@/lib/db";
import { shouldRunInterviewCrawl } from "@/lib/interview/import-core";
import {
  acquireTaskLock,
  baseEnv,
  failTask,
  findRepoRoot,
  setTaskPid,
  spawnDetached,
} from "@/lib/tasks/runner";

/**
 * 面试题库爬虫触发（v1.26）—— 与岗位爬虫（lib/tasks/crawler.ts）同款框架：
 *   1. task_runs 表级互斥锁（同 key 在 TTL 内只允许一个实例，cron 与手动撞车也安全）
 *   2. detached 启动脚本，不阻塞 HTTP 响应
 *   3. interview_crawl_runs 落运行记录（先写 running，脚本结束时经导入接口改写终态）
 *   4. 幂等守卫：当天已有 status='success' 的行 → cron 直接跳过（补跑无害）
 *
 * 与岗位爬虫的唯一区别是"运行记录表不同"（job_crawler_runs vs interview_crawl_runs），
 * 这样两条来源线的守卫互不干扰。
 */
export const INTERVIEW_TASK_KEY = "crawler:interview";

export interface InterviewRunPatch {
  status: "running" | "success" | "partial" | "failed";
  fetched?: number;
  imported?: number;
  skipped?: number;
  error?: string | null;
  sourcesResult?: Record<string, unknown>;
}

export interface InterviewCrawlTriggerResult {
  started: boolean;
  runId?: number;
  reason?: string;
  retryAfterSeconds?: number;
}

/** 更新运行记录（脚本通过导入接口回调时也会走这里） */
export async function markInterviewRun(runId: number, patch: InterviewRunPatch): Promise<void> {
  await pgPool.query(
    `UPDATE interview_crawl_runs SET
       status = $2,
       fetched_count = COALESCE($3, fetched_count),
       imported_count = COALESCE($4, imported_count),
       skipped_count = COALESCE($5, skipped_count),
       sources_result = COALESCE($6::jsonb, sources_result),
       error = $7,
       finished_at = CASE WHEN $2 = 'running' THEN finished_at ELSE now() END
     WHERE id = $1`,
    [
      runId,
      patch.status,
      patch.fetched ?? null,
      patch.imported ?? null,
      patch.skipped ?? null,
      patch.sourcesResult ? JSON.stringify(patch.sourcesResult) : null,
      patch.error ?? null,
    ]
  );
}

/** 新建一条 running 运行记录并返回 id（脚本据此回报终态） */
export async function startInterviewRun(startedBy: string): Promise<number> {
  const { rows } = await pgPool.query<{ id: string }>(
    `INSERT INTO interview_crawl_runs (status, started_by, started_at) VALUES ('running', $1, now()) RETURNING id`,
    [startedBy]
  );
  return Number(rows[0]?.id ?? 0);
}

/**
 * 触发一次面试题抓取（detached）。
 * dryRun=true 时脚本只解析+本地落盘，不调导入接口（用于链路自检）。
 */
export async function triggerInterviewCrawl(
  startedBy: string,
  opts: { limit?: number; files?: number; dryRun?: boolean } = {}
): Promise<InterviewCrawlTriggerResult> {
  const repoRoot = findRepoRoot("scripts/crawl_interview.mjs");

  const lock = await acquireTaskLock(INTERVIEW_TASK_KEY, startedBy);
  if (!lock.acquired) {
    return { started: false, reason: "locked", retryAfterSeconds: lock.retryAfterSeconds };
  }

  const runId = await startInterviewRun(startedBy);
  const args = [path.join(repoRoot, "scripts", "crawl_interview.mjs"), "--import", "--run-id", String(runId)];
  if (opts.limit) args.push("--limit", String(opts.limit));
  if (opts.files) args.push("--files", String(opts.files));
  if (opts.dryRun) args.push("--dry-run");

  const spawned = spawnDetached("node", args, baseEnv());
  if (!spawned.ok) {
    const error = spawned.error ?? "spawn failed";
    await markInterviewRun(runId, { status: "failed", error });
    await failTask(INTERVIEW_TASK_KEY, error);
    return { started: false, reason: "spawn-failed", runId };
  }

  await setTaskPid(lock.runId!, spawned.pid);
  return { started: true, runId };
}

/** 幂等守卫：今天是否已有一次成功的面试爬取 */
export async function interviewCrawlerRanSuccessfullyToday(): Promise<boolean> {
  const { rows } = await pgPool.query<{ id: number }>(
    `SELECT id FROM interview_crawl_runs
      WHERE status = 'success' AND started_at >= CURRENT_DATE LIMIT 1`
  );
  return !shouldRunInterviewCrawl(rows);
}
