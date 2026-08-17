import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function findRepoRoot(): string {
  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "..", ".."),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, "scripts", "fetch_jobs.py"))) return c;
  }
  return path.resolve(cwd, "..", "..");
}
const REPO_ROOT = findRepoRoot();

function findPython(): string | null {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidates = ["python3", "python", "py"];
  for (const c of candidates) {
    const r = spawnSync(c, ["--version"], { timeout: 5000 });
    if (r && r.error === undefined && r.status === 0) return c;
  }
  return null;
}

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const script = path.join(REPO_ROOT, "scripts", "fetch_jobs.py");
  if (!existsSync(script)) {
    return NextResponse.json({ error: "爬虫脚本不存在，请检查部署" }, { status: 500 });
  }
  const python = findPython();
  if (!python) {
    return NextResponse.json({ error: "未找到 Python 运行时，无法手动抓取" }, { status: 500 });
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: process.env.PGHOST || "127.0.0.1",
    PGPORT: process.env.PGPORT || "5432",
    PGDATABASE: process.env.PGDATABASE || "Learn-Workbench",
    PGUSER: process.env.PGUSER || "postgres",
    PGPASSWORD: process.env.PGPASSWORD || "",
    PSQL_BIN: process.env.PSQL_BIN || "",
  };
  const args = ["-u", script];
  if (process.env.JOBS_MOCK === "1") args.push("--mock");
  if (process.env.JOBS_COOKIES_FILE) args.push("--cookies-file", process.env.JOBS_COOKIES_FILE);
  if (process.env.JOBS_DEBUG === "1") args.push("--debug");
  if (process.env.JOBS_CONCURRENCY) args.push("--concurrency", process.env.JOBS_CONCURRENCY);

  const child = spawn(python, args, {
    cwd: REPO_ROOT,
    env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return NextResponse.json({ started: true });
}
