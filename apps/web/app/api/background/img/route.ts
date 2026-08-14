import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function findBgDir(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "assets", "backgrounds", "bing");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date 格式应为 YYYY-MM-DD" }, { status: 400 });
  }
  const dir = findBgDir();
  if (!dir) return NextResponse.json({ error: "not found" }, { status: 404 });
  const file = path.join(dir, `${date}.jpg`);
  if (!fs.existsSync(file)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const stat = fs.statSync(file);
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }
  const buf = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
      ETag: etag,
      "Last-Modified": stat.mtime.toUTCString(),
    },
  });
}