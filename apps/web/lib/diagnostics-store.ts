import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 客户端诊断包存储（v1.32.0，招花闪退排障）。
 *
 * 与简历文件同一条约定（见 lib/resume-files.ts）：
 *  - 落 **私密目录**（`<UPLOAD_DIR 同级的 private>/`），compose 把它挂成 /app/public/private
 *    → 宿主机是 /data/learn-workbench/private（COS 桶）；**nginx 不直出**，只能经 API 校验后读；
 *  - 路径带 userId 分目录，天然按用户隔离（数据隔离铁律）；
 *  - 不做任何转换，原样落盘（诊断包就是文本 JSON）。
 *
 * 注意：**存了不等于有人看**。日志是给人排障用的，读法（ssh 直取）写在看板 v1.32.0 段。
 */
export const DIAGNOSTIC_MAX_BYTES = 512 * 1024;

export function diagnosticsRootDir(): string {
  if (process.env.DIAGNOSTICS_DIR) return process.env.DIAGNOSTICS_DIR;
  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");
  return path.join(path.dirname(uploadDir), "private", "diagnostics");
}

/** 归属目录名：userId / anonId / 兜底串，只允许安全字符（防穿越） */
export function isSafeDiagnosticOwner(owner: string): boolean {
  return /^[0-9a-zA-Z_-]{1,64}$/.test(String(owner ?? ""));
}

export function diagnosticRelPath(owner: string, id: string): string {
  return path.posix.join(owner, id + ".json");
}

export function diagnosticsAbsPath(rel: string): string {
  return path.join(diagnosticsRootDir(), rel);
}

/** 相对路径安全校验（读侧也用它，别只在写侧校验） */
export function isSafeDiagnosticPath(rel: string): boolean {
  if (!rel || rel.includes("..") || rel.startsWith("/") || rel.includes("\\")) return false;
  return /^[0-9a-zA-Z_-]{1,64}\/[0-9a-zA-Z-]{8,64}\.json$/.test(rel);
}

export type BodyCheck =
  | { ok: true; bytes: number; owner?: undefined; error?: undefined; status?: undefined }
  | { ok: false; error: string; status: number };

/**
 * 校验上报正文：必须是能解析的 JSON，且不超过上限。
 * 先看字节数再看 JSON —— 免得一个 10MB 的垃圾把 JSON.parse 卡住。
 */
export function validateDiagnosticBody(text: string): BodyCheck {
  const raw = typeof text === "string" ? text : "";
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes === 0) return { ok: false, error: "空请求体", status: 400 };
  if (bytes > DIAGNOSTIC_MAX_BYTES) {
    return { ok: false, error: "诊断包太大了（上限 " + Math.round(DIAGNOSTIC_MAX_BYTES / 1024) + "KB）", status: 413 };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "诊断包必须是 JSON 对象", status: 400 };
    }
  } catch {
    return { ok: false, error: "诊断包不是合法 JSON", status: 400 };
  }
  return { ok: true, bytes };
}

export async function saveDiagnosticReport(rel: string, body: string): Promise<void> {
  const abs = diagnosticsAbsPath(rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, body, "utf8");
}
