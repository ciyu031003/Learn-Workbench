import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function findRepoRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "..", "..")];
  for (const c of candidates) {
    if (existsSync(path.join(c, "scripts", "jobs_official.mjs"))) return c;
  }
  return path.resolve(cwd, "..", "..");
}

function baseEnv(): NodeJS.ProcessEnv {
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

/** 后台启动一个爬虫脚本（detached，不阻塞响应） */
function launch(script: string, args: string[], env: NodeJS.ProcessEnv): void {
  const child = spawn("node", [script, ...args], {
    cwd: path.dirname(path.dirname(script)) === process.cwd() ? process.cwd() : process.cwd(),
    env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const repoRoot = findRepoRoot();
  const env = baseEnv();
  const body = await req.json().catch(() => null);
  const scope = body?.scope ?? "all"; // all / official / internet
  const engines: string[] = [];

  if (scope === "all" || scope === "official") {
    const script = path.join(repoRoot, "scripts", "jobs_official.mjs");
    if (existsSync(script)) {
      launch(script, [], env);
      engines.push("official");
    }
  }
  if (scope === "all" || scope === "internet") {
    const script = path.join(repoRoot, "scripts", "jobs_browser.mjs");
    if (existsSync(script)) {
      const args: string[] = [];
      if (process.env.JOBS_LIMIT) args.push("--limit", process.env.JOBS_LIMIT);
      launch(script, args, env);
      engines.push("internet");
    }
  }

  if (engines.length === 0) {
    return NextResponse.json({ error: "未找到可运行的爬虫脚本" }, { status: 500 });
  }
  return NextResponse.json({ started: true, engines });
}
