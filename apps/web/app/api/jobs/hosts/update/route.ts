import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function findRepoRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "..", "..")];
  for (const c of candidates) {
    if (existsSync(path.join(c, "scripts", "update_job_hosts.mjs"))) return c;
  }
  return path.resolve(cwd, "..", "..");
}

function launch(script: string, env: NodeJS.ProcessEnv): void {
  const child = spawn("node", [script], {
    env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const repoRoot = findRepoRoot();
  const script = path.join(repoRoot, "scripts", "update_job_hosts" + ".mjs");
  if (!existsSync(script)) {
    return NextResponse.json({ error: "hosts 更新脚本不存在" }, { status: 500 });
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: process.env.PGHOST || "127.0.0.1",
    PGPORT: process.env.PGPORT || "5432",
    PGDATABASE: process.env.PGDATABASE || "Learn-Workbench",
    PGUSER: process.env.PGUSER || "postgres",
    PGPASSWORD: process.env.PGPASSWORD || "",
  };
  launch(script, env);
  return NextResponse.json({ started: true });
}
