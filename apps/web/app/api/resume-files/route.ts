import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import {
  contentTypeFor,
  RESUME_MAX_BYTES,
  resumeRelPath,
  saveResumeFile,
  validateResumeFile,
} from "@/lib/resume-files";

const SELECT_COLS = "id, file_name AS \"fileName\", mime, bytes, created_at AS \"createdAt\"";

/** GET /api/resume-files —— 我的简历文件列表（不含文件本体） */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { rows } = await pgPool.query(
    "SELECT " + SELECT_COLS + " FROM resume_files WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC",
    [userId]
  );
  return NextResponse.json({
    files: rows.map((r) => ({ ...r, bytes: Number(r.bytes) })),
    maxBytes: RESUME_MAX_BYTES,
  });
}

/**
 * POST /api/resume-files —— 上传简历（multipart/form-data：file）
 * 校验：PDF / DOC / DOCX，≤5MB；原样落盘（不走图片处理），库里只登记元数据。
 */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "缺少文件" }, { status: 400 });

  const check = validateResumeFile({ size: file.size, name: file.name, type: file.type });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const id = randomUUID();
  const rel = resumeRelPath(userId, id, check.ext);
  try {
    await saveResumeFile(rel, await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "文件保存失败，请重试" }, { status: 500 });
  }

  const { rows } = await pgPool.query(
    "INSERT INTO resume_files (user_id, file_name, path, mime, bytes) VALUES ($1,$2,$3,$4,$5) RETURNING " + SELECT_COLS,
    [userId, String(file.name).slice(0, 200) || "简历", rel, file.type || contentTypeFor(check.ext), file.size]
  );
  return NextResponse.json({ file: { ...rows[0], bytes: Number(rows[0]?.bytes ?? 0) } }, { status: 201 });
}
