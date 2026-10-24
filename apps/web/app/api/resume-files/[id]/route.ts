import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { verifyFileTicket } from "@/lib/file-ticket";
import { withPrivateNoStore } from "@/lib/api/cache";
import { parseBody } from "@/lib/http";
import { contentTypeFor, isSafeResumePath, removeResumeFile, resumeAbsPath, resumeExtOf } from "@/lib/resume-files";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * 取预览身份（S2-3 起不再接受 URL 上的长期会话 token）：
 *  - `?sig=xxx`：5 分钟一次性票据（移动端系统浏览器带不了 Authorization 头）；
 *    票据里带 fileId + uid，下面必须再校验 fileId 与路由 id 一致。
 *  - 无 sig：回落 cookie / Bearer 会话 —— Web 端直接点 `<a href="/api/resume-files/id">` 走这条。
 *
 * ⚠️ 历史实现支持 `?token=<30 天会话 token>`，会进 nginx access log / 浏览器历史 /
 * Referer；该分支已删除（`userIdFromToken` 一并下线），不要再加回来。
 */
async function viewerId(req: Request, id: number): Promise<{ userId: string } | { error: NextResponse }> {
  const sig = new URL(req.url).searchParams.get("sig");
  if (sig) {
    const ticket = verifyFileTicket(sig);
    if (!ticket) return { error: NextResponse.json({ error: "预览链接已失效，请重新打开" }, { status: 401 }) };
    if (ticket.fileId !== id) return { error: NextResponse.json({ error: "票据与文件不匹配" }, { status: 403 }) };
    return { userId: ticket.uid };
  }
  const userId = await currentUserId();
  if (!userId) return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  return { userId };
}

/**
 * GET /api/resume-files/[id] —— 预览 / 下载自己的简历文件
 * 默认 inline（浏览器里直接看 PDF）；加 ?download=1 触发下载。**只有本人能取。**
 */
async function getImpl(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const viewer = await viewerId(req, id);
  if ("error" in viewer) return viewer.error;
  const userId = viewer.userId;

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
      // S5-5：私有内容同样不落任何缓存层（登录态业务响应 → private, no-store）
      "Cache-Control": "private, no-store",
    },
  });
}

/** DELETE /api/resume-files/[id] —— 删除自己的简历（软删 + 清文件） */
async function deleteImpl(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

/** PATCH /api/resume-files/[id] —— 重命名自己的简历（只改显示名 file_name，不动存储路径） */
async function patchImpl(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await parseBody(req);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const raw = (body.data as { fileName?: unknown } | null)?.fileName;
  if (typeof raw !== "string") return NextResponse.json({ error: "fileName 无效" }, { status: 400 });
  // 控制字符压成空格 + 限长：file_name 会进 Content-Disposition，不能带换行
  const cleaned = raw.replace(/[\r\n\t\u0000-\u001f]+/g, " ").trim().slice(0, 120);
  if (!cleaned) return NextResponse.json({ error: "文件名不能为空" }, { status: 400 });

  const { rows } = await pgPool.query<{ path: string }>(
    "SELECT path FROM resume_files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [id, userId]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  // 重命名的是显示名不是文件类型：新名字没写扩展名时沿用原扩展
  const ext = resumeExtOf(row.path);
  const fileName = ext && !/\.[a-z0-9]{1,8}$/i.test(cleaned) ? `${cleaned}.${ext}` : cleaned;

  const { rows: updated } = await pgPool.query<{ fileName: string }>(
    `UPDATE resume_files SET file_name = $3 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING file_name AS "fileName"`,
    [id, userId, fileName]
  );
  return NextResponse.json({ ok: true, fileName: updated[0]?.fileName ?? fileName });
}

/* S5-5：私有内容的所有响应（含 401/403/404）一律 private, no-store */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withPrivateNoStore(await getImpl(req, ctx));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withPrivateNoStore(await deleteImpl(_req, ctx));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withPrivateNoStore(await patchImpl(req, ctx));
}
