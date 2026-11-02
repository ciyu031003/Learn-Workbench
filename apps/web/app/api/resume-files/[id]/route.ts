import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { verifyFileTicket } from "@/lib/file-ticket";
import { withPrivateNoStore } from "@/lib/api/cache";
import { parseBody } from "@/lib/http";
import { contentTypeFor, isSafeResumePath, removeResumeFile, resumeAbsPath, resumeExtOf } from "@/lib/resume-files";
// P2-1：简历领域标签白名单收进 shared 单一出口（Web 与 App 共用，避免两套常量）
import { RESUME_LABELS, normalizeResumeLabel } from "@learn-workbench/shared/labels";
import { logger } from "@/lib/logger";

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

/**
 * P2-1 · 默认简历回溯：给该用户补一条默认（没有默认时把最近上传的一份设为默认）。
 *
 * 与 apps/web/app/api/resume-files/route.ts 的 ensureSingleDefault 同一条 SQL（两处各自持有，
 * 避免跨 route 文件互相 import）。并发安全：UPDATE 内再判一次 NOT EXISTS，部分唯一索引
 * uq_resume_files_default 兜底；失败只记日志（下次 GET 会再试，列表不受影响）。
 */
async function ensureSingleDefault(userId: string): Promise<string | null> {
  try {
    const { rows } = await pgPool.query<{ id: string }>(
      `UPDATE resume_files SET is_default = true
        WHERE id = (
          SELECT id FROM resume_files
           WHERE user_id = $1 AND deleted_at IS NULL
           ORDER BY created_at DESC, id DESC
           LIMIT 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM resume_files
           WHERE user_id = $1 AND deleted_at IS NULL AND is_default
        )
       RETURNING id::text AS id`,
      [userId]
    );
    return rows[0]?.id ?? null;
  } catch (error) {
    logger.error("resume-files: 默认简历回溯失败", error);
    return null;
  }
}

/**
 * DELETE /api/resume-files/[id] —— 删除自己的简历（软删 + 清文件）
 *
 * P2-1：删掉的若是「默认简历」，自动把剩余最新一份提升为默认（返回 promoted 便于客户端即时更新）；
 * 提升失败不影响删除结果（下次 GET 列表会自愈）。
 */
async function deleteImpl(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { rows } = await pgPool.query<{ path: string; isDefault: boolean }>(
    'UPDATE resume_files SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING path, is_default AS "isDefault"',
    [id, userId]
  );
  if (!rows[0]) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  await removeResumeFile(rows[0].path);

  // 删的是默认简历 → 立刻提升剩余最新一份（不是默认的删除不需要动默认标记）
  const promoted = rows[0].isDefault ? await ensureSingleDefault(userId) : null;
  return NextResponse.json({ ok: true, promoted });
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

/**
 * 解析 label 入参（P1-5，白名单 P2-1 起来自 @learn-workbench/shared/labels）：
 * - 不传 → 不修改；
 * - null / 空串 / 纯空白 → 清除标签（写 NULL）；
 * - 其余必须是白名单里的值：**不允许自由文本**（否则客户端各写一套标签，筛选与展示都会失控）。
 */
function parseLabelInput(value: unknown): { ok: true; label: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, label: null };
  if (typeof value !== "string") return { ok: false, error: "label 无效" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, label: null };
  const normalized = normalizeResumeLabel(trimmed);
  if (!normalized) {
    return { ok: false, error: "label 必须是：" + RESUME_LABELS.join(" / ") };
  }
  return { ok: true, label: normalized };
}

/**
 * PATCH /api/resume-files/[id] —— 重命名 / 打领域标签 / 设默认简历（P1-5 扩展）。
 *
 * 入参可组合（至少给一个）：{ fileName?, label?, isDefault? }
 * - fileName：只改显示名，扩展名以存储路径为准（见 normalizeRenameInput）；
 * - label：白名单值，null/空串清除；
 * - isDefault：true 时在同一事务里先把该用户其它行置 false 再置本条 true
 *   （先清后置 + 部分唯一索引 uq_resume_files_default 双保险，避免唯一冲突）。
 *
 * 所有字段都只作用于「本人且未软删」的行；返回更新后的 fileName / label / isDefault。
 */
async function patchImpl(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await parseBody(req);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const data = (body.data ?? null) as Record<string, unknown> | null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const hasFileName = Object.prototype.hasOwnProperty.call(data, "fileName");
  const hasLabel = Object.prototype.hasOwnProperty.call(data, "label");
  const hasDefault = Object.prototype.hasOwnProperty.call(data, "isDefault");
  if (!hasFileName && !hasLabel && !hasDefault) {
    return NextResponse.json({ error: "没有可更新的字段（fileName / label / isDefault）" }, { status: 400 });
  }

  if (hasFileName && typeof data.fileName !== "string") {
    return NextResponse.json({ error: "fileName 无效" }, { status: 400 });
  }
  let nextLabel: string | null = null;
  if (hasLabel) {
    const parsed = parseLabelInput(data.label);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    nextLabel = parsed.label;
  }
  let nextIsDefault: boolean | null = null;
  if (hasDefault) {
    if (typeof data.isDefault !== "boolean") {
      return NextResponse.json({ error: "isDefault 必须是布尔值" }, { status: 400 });
    }
    nextIsDefault = data.isDefault;
  }

  const { rows } = await pgPool.query<{
    path: string;
    fileName: string;
    label: string | null;
    isDefault: boolean;
  }>(
    'SELECT path, file_name AS "fileName", label, is_default AS "isDefault" FROM resume_files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [id, userId]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  // 重命名的是显示名不是文件类型：扩展名以存储路径为准（见 normalizeRenameInput）
  let nextFileName: string | null = null;
  if (hasFileName) {
    const normalized = normalizeRenameInput(String(data.fileName), resumeExtOf(row.path));
    if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 400 });
    nextFileName = normalized.fileName;
  }

  const sets: string[] = [];
  const params: unknown[] = [id, userId];
  if (nextFileName !== null) {
    params.push(nextFileName);
    sets.push("file_name = $" + params.length);
  }
  if (hasLabel) {
    params.push(nextLabel);
    sets.push("label = $" + params.length);
  }
  if (nextIsDefault === false) sets.push("is_default = false");
  if (nextIsDefault === true) sets.push("is_default = true");

  const updateSql =
    "UPDATE resume_files SET " +
    sets.join(", ") +
    ' WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING file_name AS "fileName", label, is_default AS "isDefault"';

  let updated: { fileName: string; label: string | null; isDefault: boolean } | undefined;
  if (nextIsDefault === true) {
    // 默认互斥：先清掉其它默认再置本条，两条语句必须同事务（部分唯一索引兜底）
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE resume_files SET is_default = false WHERE user_id = $1 AND deleted_at IS NULL AND is_default AND id <> $2",
        [userId, id]
      );
      const result = await client.query<{ fileName: string; label: string | null; isDefault: boolean }>(updateSql, params);
      await client.query("COMMIT");
      updated = result.rows[0];
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // 回滚失败不掩盖原始错误
      }
      throw error;
    } finally {
      client.release();
    }
  } else {
    const result = await pgPool.query<{ fileName: string; label: string | null; isDefault: boolean }>(updateSql, params);
    updated = result.rows[0];
  }

  return NextResponse.json({
    ok: true,
    fileName: updated?.fileName ?? nextFileName ?? row.fileName,
    label: hasLabel ? (updated?.label ?? nextLabel) : (row.label ?? null),
    isDefault:
      updated?.isDefault !== undefined ? Boolean(updated.isDefault) : (nextIsDefault ?? Boolean(row.isDefault)),
  });
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
