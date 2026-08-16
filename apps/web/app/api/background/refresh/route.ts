import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

// 手动触发爬虫抓取今日 Bing 壁纸（本地个人工具，按需调用）
export async function POST() {
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