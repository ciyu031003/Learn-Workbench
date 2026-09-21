import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 简历文件存储（v12 P2-2）：PDF / Word，单文件 ≤5MB。
 *
 * 与图片上传的区别（有意为之）：
 *  - **不放 nginx 直出目录**：图片在 `<UPLOAD_DIR>`（nginx /uploads/ 直出，公开只读）；
 *    简历放在同盘的 `resume/` 子目录，**只有** `GET /api/resume-files/[id]` 能取，且必须是本人；
 *  - 不做 sharp 处理（不是图片），只校验类型 + 大小，原样落盘。
 *
 * 想升级成 COS 私有桶签名 URL 时：只需把 save/read/remove 换成 COS SDK，接口与前端不用动。
 */
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

/** 允许的类型（扩展名 → mime 白名单） */
export const RESUME_ALLOWED: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

export function resumeRootDir(): string {
  // 默认与图片同盘：<UPLOAD_DIR 的父目录>/resume（服务器上即 /data/learn-workbench/resume）
  if (process.env.RESUME_DIR) return process.env.RESUME_DIR;
  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");
  return path.join(path.dirname(uploadDir), "resume");
}

export function resumeExtOf(fileName: string): string | null {
  const ext = path.extname(String(fileName ?? "")).replace(".", "").toLowerCase();
  return ext in RESUME_ALLOWED ? ext : null;
}

export function contentTypeFor(ext: string): string {
  return RESUME_ALLOWED[ext]?.[0] ?? "application/octet-stream";
}

export function validateResumeFile(file: { size: number; name: string; type?: string }): { ok: true; ext: string } | { ok: false; error: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "文件为空" };
  if (file.size > RESUME_MAX_BYTES) {
    return { ok: false, error: "文件太大了（上限 " + Math.round(RESUME_MAX_BYTES / 1024 / 1024) + "MB）" };
  }
  const ext = resumeExtOf(file.name);
  if (!ext) return { ok: false, error: "只支持 PDF / DOC / DOCX" };
  const type = String(file.type ?? "").toLowerCase();
  // 有些浏览器/系统给的 mime 不标准：扩展名对但 mime 缺失或为 octet-stream 时放行
  if (type && type !== "application/octet-stream" && !RESUME_ALLOWED[ext].includes(type)) {
    return { ok: false, error: "文件类型与扩展名不匹配（只支持 PDF / DOC / DOCX）" };
  }
  return { ok: true, ext };
}

/** 桶内相对路径：<userId>/<uuid>.<ext>（userId 用于隔离目录，取文件时再校验归属） */
export function resumeRelPath(userId: string, id: string, ext: string): string {
  return path.posix.join(userId, id + "." + ext);
}

export function isSafeResumePath(rel: string): boolean {
  if (!rel || rel.includes("..") || rel.startsWith("/")) return false;
  return /^[0-9a-fA-F-]{36}\/[0-9a-zA-Z-]+\.(pdf|doc|docx)$/.test(rel);
}

export async function saveResumeFile(rel: string, data: ArrayBuffer): Promise<void> {
  const absolute = path.join(resumeRootDir(), rel);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(data));
}

export function resumeAbsPath(rel: string): string {
  return path.join(resumeRootDir(), rel);
}

export async function removeResumeFile(rel: string): Promise<void> {
  try {
    await unlink(resumeAbsPath(rel));
  } catch {
    // 文件已不在：忽略
  }
}
