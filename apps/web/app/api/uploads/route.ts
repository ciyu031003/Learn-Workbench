import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentSessionToken, currentUserId } from "@/lib/session";
import {
  UPLOAD_MAX_COUNT,
  UPLOAD_MAX_TOTAL_BYTES,
  isSafeUploadPath,
  normalizeUploadKind,
  processAndStoreImage,
  removeUploadFile,
  validateUpload,
} from "@/lib/uploads";

/** sharp 是原生模块，必须跑在 Node runtime（不能用 edge） */
export const runtime = "nodejs";

function parseRelativePath(raw: string): string {
  return raw.split("?")[0].replace(/^https?:\/\/[^/]+/i, "").replace(/^.*\/uploads\//, "");
}

/**
 * POST /api/uploads —— 上传一张图片（multipart/form-data：file + kind）
 * 返回 `{ upload: { id, path, url, bytes, width, height, kind } }`，url 是站内相对路径 /uploads/<uid>/<uuid>.webp。
 */
export async function POST(req: Request) {
  const token = await currentSessionToken();
  const userId = token ? await currentUserId() : null;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求格式不正确（需要 multipart/form-data）" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
  const check = validateUpload({ size: file.size, type: file.type });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const kind = normalizeUploadKind(form.get("kind"));
  const quota = await pgPool.query<{ count: string; bytes: string }>(
    `SELECT count(*)::text AS count, coalesce(sum(bytes), 0)::text AS bytes
       FROM uploads WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const used = quota.rows[0];
  if (Number(used?.count ?? 0) >= UPLOAD_MAX_COUNT) {
    return NextResponse.json({ error: "图片数量已达上限（" + UPLOAD_MAX_COUNT + " 张），先删几张再传" }, { status: 429 });
  }
  if (Number(used?.bytes ?? 0) + file.size >= UPLOAD_MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "图片总容量已达上限（500MB）" }, { status: 429 });
  }

  let stored;
  try {
    stored = await processAndStoreImage(userId, kind, await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "图片处理失败，请换 JPG / PNG / WebP / HEIC 再试" }, { status: 400 });
  }

  const { rows } = await pgPool.query<{ id: number }>(
    `INSERT INTO uploads (user_id, kind, path, mime, bytes, width, height)
     VALUES ($1, $2, $3, 'image/webp', $4, $5, $6)
     RETURNING id`,
    [userId, kind, stored.path, stored.bytes, stored.width, stored.height]
  );

  return NextResponse.json({ upload: { id: rows[0]?.id ?? null, kind, ...stored } }, { status: 201 });
}

/**
 * DELETE /api/uploads?url=/uploads/<uid>/<uuid>.webp —— 删除自己的图片（换图时清理）
 * url 传相对路径或完整地址都行。
 */
export async function DELETE(req: Request) {
  const token = await currentSessionToken();
  const userId = token ? await currentUserId() : null;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const relative = parseRelativePath(raw);
  if (!isSafeUploadPath(relative) || !relative.startsWith(userId + "/")) {
    return NextResponse.json({ error: "不是你的图片" }, { status: 403 });
  }

  await pgPool.query(
    `UPDATE uploads SET deleted_at = now()
      WHERE user_id = $1 AND path = $2 AND deleted_at IS NULL`,
    [userId, relative]
  );
  await removeUploadFile(relative);
  return NextResponse.json({ ok: true });
}
