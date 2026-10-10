import path from "node:path";
import {
  acquireTaskLock,
  baseEnv,
  failTask,
  findRepoRoot,
  setTaskPid,
  spawnDetached,
} from "@/lib/tasks/runner";

/**
 * 内容导入触发（组二 · 阶段 10）—— 与面试抓取（lib/tasks/interview.ts）同款框架：
 * task_runs 表级互斥锁 + detached 启动脚本 + 不阻塞 HTTP 响应。
 *
 * 与面试抓取的区别：运行记录**不另建表**，直接用 `content_import_batch`
 * （脚本通过导入接口写批次），这样"一次导入"的信息只有一个来源，不会两处不一致。
 */
export const CONTENT_IMPORT_TASK_KEY = "content:import";

export interface ContentImportTriggerResult {
  started: boolean;
  sourceKey: string;
  mode: "dry-run" | "apply";
  reason?: string;
  retryAfterSeconds?: number;
  pid?: number;
}

/**
 * 触发一次内容导入（detached）。
 * mode='apply' 才会物化草稿；默认 dry-run 只出报告。
 */
export async function triggerContentImport(
  startedBy: string,
  opts: { sourceKey: string; mode?: "dry-run" | "apply"; limit?: number; ref?: string } 
): Promise<ContentImportTriggerResult> {
  const sourceKey = String(opts.sourceKey ?? "").trim();
  const mode: "dry-run" | "apply" = opts.mode === "apply" ? "apply" : "dry-run";
  if (!sourceKey) return { started: false, sourceKey, mode, reason: "missing-source" };

  const repoRoot = findRepoRoot("scripts/crawl_content_source.mjs");
  const lock = await acquireTaskLock(CONTENT_IMPORT_TASK_KEY, startedBy);
  if (!lock.acquired) {
    return { started: false, sourceKey, mode, reason: "locked", retryAfterSeconds: lock.retryAfterSeconds };
  }

  const args = [
    path.join(repoRoot, "scripts", "crawl_content_source.mjs"),
    `--source=${sourceKey}`,
    `--mode=${mode}`,
  ];
  if (opts.limit) args.push(`--limit=${opts.limit}`);
  if (opts.ref) args.push(`--ref=${opts.ref}`);

  const spawned = spawnDetached("node", args, baseEnv());
  if (!spawned.ok) {
    const error = spawned.error ?? "spawn failed";
    await failTask(CONTENT_IMPORT_TASK_KEY, error);
    return { started: false, sourceKey, mode, reason: "spawn-failed" };
  }

  await setTaskPid(lock.runId!, spawned.pid);
  return { started: true, sourceKey, mode, pid: spawned.pid };
}
