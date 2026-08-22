import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/http";
import {
  acquireTaskLock,
  baseEnv,
  failTask,
  findRepoRoot,
  setTaskPid,
  spawnDetached,
} from "@/lib/tasks/runner";
import path from "node:path";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  // P0：爬虫触发为受限操作，仅管理员可执行
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "无权限执行爬虫任务" }, { status: 403 });
  }
  const throttle = rateLimit(`crawler:run:${userId}`, { limit: 3, windowMs: 600_000 });
  if (!throttle.ok) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds }, { status: 429 });
  }

  const parsed = await parseBody(req, 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const scope = body.scope ?? "all"; // all / official / internet

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
  if (tasks.length === 0) {
    return NextResponse.json({ error: "scope 无效" }, { status: 400 });
  }

  const engines: { name: string; started: boolean; runId?: number }[] = [];
  for (const t of tasks) {
    const lock = await acquireTaskLock(t.key, userId);
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

  if (engines.every((e) => !e.started)) {
    return NextResponse.json(
      { error: "爬虫正在运行中，请稍后再试", engines },
      { status: 409 }
    );
  }
  return NextResponse.json({ started: true, engines });
}