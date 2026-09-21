import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { pgPool } from "@/lib/db";
import { currentUserId, userIdFromToken } from "@/lib/session";
import { contentTypeFor, isSafeResumePath, removeResumeFile, resumeAbsPath, resumeExtOf } from "@/lib/resume-files";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * 取当前用户：优先 Authorization/cookie；移动端预览时浏览器带不了头，
 * 允许 URL 上带 ?token=<会话 token>（同一张 sessions 表校验）。
 */
async function viewerId(req: Request): Promise<string | null> {
  const token = new URL(req.url).searchParams.get("token");
  if (token) return userIdFromToken(token);
  return currentUserId();
}

/**
 * GET /api/resume-files/[id] —— 预览 / 下载自己的简历文件
 * 默认 inline（浏览器里直接看 PDF）；加 ?download=1 触发下载。**只有本人能取。**
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const userId = await viewerId(req);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { rows } = await pgPool.query<{ path: string; fileName: string; mime: string }>(
    "SELECT path, file_name AS \"fileName\", mime FROM resume_files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [id, userId]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  if (!isSafeResumePath(row.path)) return NextResponse.json({ error: "路径非法" }, { status: 400 });

  const data = await readFile(resumeAbsPath(row.path)).catch(() => null);
  if (!data) return NextResponse.json({ error: "文件已丢失" }, { status: 404 });

  const ext = resumeExtOf(row.path) ?? "pdf";
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": row.mime || contentTypeFor(ext),
      "Content-Length": String(data.length),
      "Content-Disposition": (download ? "attachment" : "inline") + "; filename*=UTF-8\x27\x27" + encodeURIComponent(row.fileName),
      // 私有内容：只允许浏览器私有缓存，别让 CDN/代理缓存
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** DELETE /api/resume-files/[id] —— 删除自己的简历（软删 + 清文件） */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { rows } = await pgPool.query<{ path: string }>(
    "UPDATE resume_files SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING path",
    [id, userId]
  );
  if (!rows[0]) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  await removeResumeFile(rows[0].path);
  return NextResponse.json({ ok: true });
}
