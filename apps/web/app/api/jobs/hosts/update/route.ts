import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  acquireTaskLock,
  baseEnv,
  failTask,
  findRepoRoot,
  setTaskPid,
  spawnDetached,
} from "@/lib/tasks/runner";
import path from "node:path";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  // P0：hosts 注册表更新为受限操作，仅管理员可执行
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "无权限更新信息源注册表" }, { status: 403 });
  }
  const throttle = rateLimit(`hosts:update:${userId}`, { limit: 2, windowMs: 300_000 });
  if (!throttle.ok) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds }, { status: 429 });
  }

  const repoRoot = findRepoRoot("scripts/update_job_hosts.mjs");
  const script = path.join(repoRoot, "scripts", "update_job_hosts.mjs");
  const lock = await acquireTaskLock("hosts:update", userId);
  if (!lock.acquired) {
    return NextResponse.json({ error: "hosts 更新已在运行中，请稍后再试" }, { status: 409 });
  }
  const spawned = spawnDetached("node", [script], baseEnv());
  if (!spawned.ok) {
    await failTask("hosts:update", spawned.error ?? "spawn failed");
    return NextResponse.json({ error: "启动 hosts 更新脚本失败" }, { status: 500 });
  }
  await setTaskPid(lock.runId!, spawned.pid);
  return NextResponse.json({ started: true });
}