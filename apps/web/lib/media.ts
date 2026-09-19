/**
 * 前端媒体小工具（Web 端）：上传图片到站内 `/api/uploads`，把相对路径补成可用地址。
 * 服务端会统一压成 WebP 并返回站内相对路径（与移动端同一接口）。
 */

export type UploadKind = "avatar" | "racket" | "shoes" | "string" | "grip" | "ball" | "other";

/** 相对路径 → 可直接放进 img src 的地址（Web 与 API 同源，相对路径即可） */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  return value || null;
}

/** 由装备行标签猜上传类别 */
export function kindFromGearLabel(label: string): UploadKind {
  const text = label.toLowerCase();
  if (/球拍|底板|racket/.test(text)) return "racket";
  if (/鞋|shoe|战靴/.test(text)) return "shoes";
  if (/线|string|胶皮|磅/.test(text)) return "string";
  if (/手胶|grip|握把/.test(text)) return "grip";
  if (/球$|ball/.test(text)) return "ball";
  return "other";
}

export async function uploadImageFile(kind: UploadKind, file: File): Promise<{ url: string; id: number | null }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(typeof data?.error === "string" ? data.error : "上传失败，请重试");
  }
  const data = await res.json();
  return { url: String(data?.upload?.url ?? ""), id: Number(data?.upload?.id) || null };
}

export async function deleteUpload(url: string): Promise<void> {
  try {
    await fetch("/api/uploads?url=" + encodeURIComponent(url), { method: "DELETE" });
  } catch {
    // 忽略
  }
}
