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

/** 显示名上限：file_name 会进 Content-Disposition，长度必须可控（App 端同值 80） */
const RESUME_FILE_NAME_MAX = 80;
/** 只允许这几种扩展名（与 lib/resume-files.ts 的 RESUME_ALLOWED 对齐） */
const RESUME_RENAME_EXTS = ["pdf", "doc", "docx"] as const;

/**
 * 把用户输入的重命名清洗成最终显示名。
 *
 * 规则（与 App 端 apps/mobile/src/lib/resume-files.ts 的 normalizeResumeFileName 同口径）：
 *  - 控制字符压成空格、连续空白折叠成单个空格、去首尾空白与首尾点；
 *  - **禁止路径分隔符**（/ \\），也不接受空名 —— 显示名会被拼进 Content-Disposition 的文件名参数；
 *  - **保留原扩展名**：只允许改主干；用户写别的合法扩展名（pdf/doc/docx）一律被原扩展覆盖，
 *    没写扩展名则自动补上（"简历 v2.0" 这种带点但不是扩展名的名字也能正确补 .pdf）；
 *  - 最终长度（含扩展名）≤ 80 字符，超了直接 400，不静默截断（客户端有 maxLength，截断会让人以为改成功）。
 */
function normalizeRenameInput(raw: string, storedExt: string | null): { ok: true; fileName: string } | { ok: false; error: string } {
  const cleaned = raw
    .replace(/[\r\n\t\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim();
  if (/[\\/]/.test(cleaned)) return { ok: false, error: "文件名不能包含 / 或 \\" };
  if (!cleaned) return { ok: false, error: "文件名不能为空" };

  if (!storedExt) {
    if (cleaned.length > RESUME_FILE_NAME_MAX) return { ok: false, error: "文件名最多 " + RESUME_FILE_NAME_MAX + " 个字符" };
    return { ok: true, fileName: cleaned };
  }

  const typed = /^(.*)\.([a-z0-9]{1,8})$/i.exec(cleaned);
  const typedExt = typed ? typed[2].toLowerCase() : null;
  // 用户写的扩展名和原扩展相同（忽略大小写）→ 原样保留用户的大小写写法
  if (typed && typedExt === storedExt) {
    if (cleaned.length > RESUME_FILE_NAME_MAX) return { ok: false, error: "文件名最多 " + RESUME_FILE_NAME_MAX + " 个字符" };
    return { ok: true, fileName: cleaned };
  }
  // 其余情况：丢掉用户可能写错的扩展名（仅当它确实是 pdf/doc/docx 之一），保留原扩展
  const typedAllowed = typedExt !== null && (RESUME_RENAME_EXTS as readonly string[]).includes(typedExt);
  const base = (typedAllowed && typed ? typed[1] : cleaned).replace(/^\.+|\.+$/g, "").trim();
  if (!base) return { ok: false, error: "文件名不能为空" };
  const fileName = base + "." + storedExt;
  if (fileName.length > RESUME_FILE_NAME_MAX) return { ok: false, error: "文件名最多 " + RESUME_FILE_NAME_MAX + " 个字符" };
  return { ok: true, fileName };
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

  const { rows } = await pgPool.query<{ path: string }>(
    "SELECT path FROM resume_files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [id, userId]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  // 重命名的是显示名不是文件类型：扩展名以存储路径为准（见 normalizeRenameInput）
  const normalized = normalizeRenameInput(raw, resumeExtOf(row.path));
  if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 400 });

  const { rows: updated } = await pgPool.query<{ fileName: string }>(
    `UPDATE resume_files SET file_name = $3 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING file_name AS "fileName"`,
    [id, userId, normalized.fileName]
  );
  return NextResponse.json({ ok: true, fileName: updated[0]?.fileName ?? normalized.fileName });
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
