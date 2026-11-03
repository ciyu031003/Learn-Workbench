import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { withPrivateNoStore } from "@/lib/api/cache";
import { ensureSingleDefault } from "@/lib/resume-default";
import {
  contentTypeFor,
  RESUME_MAX_BYTES,
  resumeRelPath,
  saveResumeFile,
  validateResumeFile,
} from "@/lib/resume-files";

const SELECT_COLS =
  "id::text AS id, file_name AS \"fileName\", mime, bytes, created_at AS \"createdAt\", label, is_default AS \"isDefault\"";

/** GET /api/resume-files —— 我的简历文件列表（不含文件本体） */
async function getImpl() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { rows } = await pgPool.query(
    "SELECT " + SELECT_COLS + " FROM resume_files WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC",
    [userId]
  );
  // 一行默认都没有且有简历 → 用 lib/resume-default 的原子提升（含 23505 重试）；本次响应也要标记它
  const hasDefault = rows.some((r) => Boolean(r.isDefault));
  const promotedId = rows.length > 0 && !hasDefault ? await ensureSingleDefault(userId) : null;
  return NextResponse.json({
    // 091：label 为 null 表示未打标；isDefault 用布尔（pg 返回 boolean，转义一次防脏驱动）
    files: rows.map((r) => ({
      ...r,
      bytes: Number(r.bytes),
      label: typeof r.label === "string" && r.label ? r.label : null,
      isDefault: Boolean(r.isDefault) || (promotedId !== null && String(r.id) === promotedId),
    })),
    maxBytes: RESUME_MAX_BYTES,
  });
}

/**
 * POST /api/resume-files —— 上传简历（multipart/form-data：file）
 * 校验：PDF / DOC / DOCX，≤5MB；原样落盘（不走图片处理），库里只登记元数据。
 */
async function postImpl(req: Request) {
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

  /**
   * 第一个上传的简历自动成为默认（P1-5）：用 NOT EXISTS 子查询在 INSERT 内一次完成，
   * 避免多一次往返；若并发上传两份，第二条会命中 NOT EXISTS 之外的分支（false），
   * 不会撞 uq_resume_files_default。
   */
  const { rows } = await pgPool.query(
    "INSERT INTO resume_files (user_id, file_name, path, mime, bytes, is_default) " +
      "VALUES ($1,$2,$3,$4,$5, NOT EXISTS (SELECT 1 FROM resume_files WHERE user_id = $1 AND deleted_at IS NULL)) RETURNING " +
      SELECT_COLS,
    [userId, String(file.name).slice(0, 200) || "简历", rel, file.type || contentTypeFor(check.ext), file.size]
  );
  return NextResponse.json(
    {
      file: {
        ...rows[0],
        bytes: Number(rows[0]?.bytes ?? 0),
        label: typeof rows[0]?.label === "string" && rows[0].label ? rows[0].label : null,
        isDefault: Boolean(rows[0]?.isDefault),
      },
    },
    { status: 201 }
  );
}

/* S5-5：登录态业务接口统一 private, no-store */
export async function GET() {
  return withPrivateNoStore(await getImpl());
}

export async function POST(req: Request) {
  return withPrivateNoStore(await postImpl(req));
}
