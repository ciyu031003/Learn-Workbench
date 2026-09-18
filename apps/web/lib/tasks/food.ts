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
 * 食物营养库导入触发（v6 P1-3）。
 *
 * 与招聘爬虫同一套机制：task_runs 表级互斥锁 + detached 子进程，不阻塞 HTTP 响应。
 * 只做批处理落库，用户端只读 `food_items`（见 docs/APP端优化方案-v6）。
 */
export async function triggerFoodImport(
  args: string[],
  startedBy = "cron"
): Promise<{ started: boolean; runId?: number }> {
  const repoRoot = findRepoRoot("scripts/import_food_db.mjs");
  const lock = await acquireTaskLock("food:import", startedBy);
  if (!lock.acquired) return { started: false };
  const spawned = spawnDetached(
    "node",
    [path.join(repoRoot, "scripts", "import_food_db.mjs"), ...args],
    baseEnv()
  );
  if (!spawned.ok) {
    await failTask("food:import", spawned.error ?? "spawn failed");
    return { started: false };
  }
  await setTaskPid(lock.runId!, spawned.pid);
  return { started: true, runId: lock.runId };
}
