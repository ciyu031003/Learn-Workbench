/**
 * 用户上传图片（运动档案头图 / 装备图）：校验、压缩、落盘、清理。
 *
 * 存储位置：`public/uploads/<userId>/<uuid>.webp`
 *  - 本地开发：Next 直接当静态资源伺服；
 *  - 生产：该目录挂的是 COS 桶（compose 卷），同时 nginx 用 `/uploads/` 直出，省一跳。
 * 数据库只登记元数据（`uploads` 表），用于配额与清理。
 */
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** 单张上限 8MB（手机直出照片通常 2–5MB） */
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
/** 每用户最多 200 张 */
export const UPLOAD_MAX_COUNT = 200;
/** 每用户总量上限 500MB */
export const UPLOAD_MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const UPLOAD_KINDS = ["avatar", "racket", "shoes", "string", "grip", "ball", "other"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function normalizeUploadKind(raw: unknown): UploadKind {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return (UPLOAD_KINDS as readonly string[]).includes(value) ? (value as UploadKind) : "other";
}

export function uploadRootDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");
}

export function uploadUrlFor(relativePath: string): string {
  return "/uploads/" + relativePath.split(path.sep).join("/");
}

/** 防目录穿越：只允许 `<uuid 段>/<文件>.webp` 形态 */
export function isSafeUploadPath(relativePath: string): boolean {
  if (!relativePath || relativePath.includes("..") || relativePath.startsWith("/")) return false;
  return /^[0-9a-fA-F-]{36}\/[0-9a-zA-Z-]+\.webp$/.test(relativePath);
}

export function validateUpload(file: { size: number; type: string }): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "文件为空" };
  if (file.size > UPLOAD_MAX_BYTES) {
    return { ok: false, error: "图片太大了（上限 " + Math.round(UPLOAD_MAX_BYTES / 1024 / 1024) + "MB）" };
  }
  if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, error: "只支持 JPG / PNG / WebP / HEIC 图片" };
  }
  return { ok: true };
}

export interface StoredUpload {
  path: string;
  url: string;
  bytes: number;
  width: number;
  height: number;
}

/** 压缩并落盘：统一转 WebP，长边 ≤1600（头像 ≤1200），EXIF 方向自动纠正 */
export async function processAndStoreImage(
  userId: string,
  kind: UploadKind,
  input: ArrayBuffer | Uint8Array
): Promise<StoredUpload> {
  const limit = kind === "avatar" ? 1200 : 1600;
  const buffer = input instanceof ArrayBuffer ? Buffer.from(input) : Buffer.from(input);
  const result = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: limit, height: limit, fit: "inside", withoutEnlargement: true })
    .webp({ quality: kind === "avatar" ? 86 : 84, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const relative = path.posix.join(userId, randomUUID() + ".webp");
  const absolute = path.join(uploadRootDir(), relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, result.data);

  return {
    path: relative,
    url: uploadUrlFor(relative),
    bytes: result.data.length,
    width: result.info.width ?? 0,
    height: result.info.height ?? 0,
  };
}

/** 删除磁盘上的图片（失败不抛错：数据库标记才是事实） */
export async function removeUploadFile(relativePath: string): Promise<void> {
  if (!isSafeUploadPath(relativePath)) return;
  try {
    await unlink(path.join(uploadRootDir(), relativePath));
  } catch {
    // 文件可能已被清理，忽略
  }
}
