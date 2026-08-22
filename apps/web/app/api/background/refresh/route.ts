import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { currentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

function findRepoRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "scripts", "fetch_bing_wallpaper.py"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// 手动触发爬虫抓取今日 Bing 壁纸（P0：要求登录 + 限流，防止匿名滥用）
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const throttle = rateLimit(`bg:refresh:${userId}`, { limit: 2, windowMs: 120_000 });
  if (!throttle.ok) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds }, { status: 429 });
  }

  const root = findRepoRoot();
  if (!root) return NextResponse.json({ error: "未找到爬虫脚本" }, { status: 500 });
  const script = path.join(root, "scripts", "fetch_bing_wallpaper.py");
  const output = await new Promise<string>((resolve) => {
    execFile(process.platform === "win32" ? "python" : "python3", [script], { cwd: root, timeout: 60_000, windowsHide: true }, (err, stdout, stderr) => {
      resolve(`${stdout ?? ""}${stderr ?? ""}${err ? ` [err] ${err.message}` : ""}`);
    });
  });
  const ok = /\[ok\]/.test(output) || output.includes("完成");
  return NextResponse.json({ ok, output: output.slice(-2000) });
}