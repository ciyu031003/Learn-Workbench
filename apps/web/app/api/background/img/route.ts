import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { getBackgroundImage } from "@/lib/background/bing";
import { logger } from "@/lib/logger";

/**
 * GET /api/background/img?date=YYYY-MM-DD —— Bing 壁纸原图。
 *
 * P10：优先从 background_images.image_data 读（生产容器没有 jpg 文件），
 * 保留 ETag / Cache-Control / Last-Modified；库里没有该日期时回退 assets 文件（本地开发兼容）。
 */
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

function notModified(etag: string, req: Request): boolean {
  return req.headers.get("if-none-match") === etag;
}

function imageResponse(data: Uint8Array, headers: Record<string, string>): NextResponse {
  // NextResponse 的 BodyInit 类型不接受 Uint8Array<ArrayBufferLike>；复制成独立 ArrayBuffer 再传。
  const body = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return new NextResponse(body, { status: 200, headers });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date 格式应为 YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const stored = await getBackgroundImage(date);
    if (stored) {
      const etag = '"' + (stored.md5 ?? stored.data.length.toString(16) + "-" + stored.updatedAt.getTime().toString(16)) + '"';
      if (notModified(etag, req)) return new NextResponse(null, { status: 304 });
      return imageResponse(new Uint8Array(stored.data), {
        "Content-Type": stored.mime,
        "Content-Length": String(stored.data.length),
        "Cache-Control": "public, max-age=86400",
        ETag: etag,
        "Last-Modified": stored.updatedAt.toUTCString(),
      });
    }
  } catch (error) {
    logger.warn("[background] 读库失败，回退 assets 文件", error);
  }

  const dir = findBgDir();
  if (!dir) return NextResponse.json({ error: "not found" }, { status: 404 });
  const file = path.join(dir, date + ".jpg");
  if (!fs.existsSync(file)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const stat = fs.statSync(file);
  const etag = '"' + stat.size.toString(16) + "-" + Math.floor(stat.mtimeMs).toString(16) + '"';
  if (notModified(etag, req)) return new NextResponse(null, { status: 304 });
  const buf = fs.readFileSync(file);
  return imageResponse(new Uint8Array(buf), {
    "Content-Type": "image/jpeg",
    "Content-Length": String(buf.length),
    "Cache-Control": "public, max-age=86400",
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
  });
}
