import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { gearKindFromLabel } from "@learn-workbench/shared";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import {
  enqueue,
  extForMime,
  loadOutbox,
  makeClientId,
  makeUploadOp,
  persistPickedImage,
  removeByUri,
  removeLocalFile,
  saveOutbox,
  type UploadOp,
} from "./upload-outbox";
import { sendUploadOp } from "./upload-sync";
import { toFlushOutcome } from "./send-outcome";

/**
 * 图片上传（运动档案的头图 / 装备图）。
 *
 * 服务端 `POST /api/uploads` 会统一压成 WebP 并落 COS 桶，返回**站内相对路径**
 * （`/uploads/<uid>/<uuid>.webp`）；本机展示时用 `absoluteMediaUrl()` 补上 apiUrl。
 */
export const UPLOAD_KINDS = ["avatar", "racket", "shoes", "string", "grip", "ball", "other"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

/** 由装备行标签猜上传类别（球拍 / 球鞋 / 拍线 / 手胶 / 球）—— 规则与网页端共用 shared 的实现 */
export function kindFromGearLabel(label: string): UploadKind {
  return gearKindFromLabel(label);
}

/** 相对路径 → 绝对地址（已经是 http(s) 的原样返回） */
export function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;
  if (/^https?:/i.test(value)) return value;
  return getApiUrl().replace(/\/+$/, "") + (value.startsWith("/") ? value : "/" + value);
}

export interface PickedImage {
  uri: string;
  mimeType: string;
}

/**
 * 打开相册选图（不裁剪，服务端统一压到长边 ≤1600）。
 *
 * 权限策略（这里是 v1.18.2 修掉的真机 bug）：
 * - **Android 13+（API 33）**：系统相册选择器（Photo Picker）**不需要任何权限**，
 *   旧代码先调 requestMediaLibraryPermissionsAsync() 会因为清单里没有 READ_MEDIA_IMAGES
 *   而直接返回 denied → 什么都没发生（用户看到的就是「点了没反应」）。所以 33+ 直接开选择器。
 * - **Android 12 及以下**：仍需 READ_EXTERNAL_STORAGE（清单里已声明，maxSdkVersion=32），拒绝时**抛错**，
 *   由调用方弹窗告知去系统设置里开启，避免再次静默失败。
 */
export function needsMediaLibraryPermission(platformOS: string, version: number | string): boolean {
  const v = Number(version);
  return platformOS === "android" && Number.isFinite(v) && v < 33;
}

export async function pickImage(): Promise<PickedImage | null> {
  if (needsMediaLibraryPermission(Platform.OS, Platform.Version)) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("没有相册访问权限，请到「系统设置 → 应用 → 苦旅 → 权限」里允许访问照片后再试");
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    // 0.92 → 0.75：手机直出照片常在 6–12MB，而服务端单张上限 8MB，
    // 上一版「上传证件照失败」大概率就卡在这里（降采样后通常 1–3MB）
    quality: 0.75,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, mimeType: normalizeImageMime(asset.mimeType, asset.uri) };
}

/** 服务端只接受 jpeg/png/webp/heic/heif；选择器偶尔给空值或 image/jpg，这里按扩展名兜底归一 */
export const ALLOWED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export function normalizeImageMime(mimeType: string | null | undefined, uri: string): string {
  const raw = (mimeType ?? "").trim().toLowerCase();
  const alias: Record<string, string> = { "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg", "image/x-png": "image/png" };
  const normalized = alias[raw] ?? raw;
  if ((ALLOWED_UPLOAD_MIME as readonly string[]).includes(normalized)) return normalized;
  const ext = (uri.split("?")[0].split(".").pop() ?? "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "image/jpeg";
}

/** 上传一张图；失败抛错（调用方展示文案）。带 `clientId` 时服务端按它去重（离线补发幂等）。 */
export async function uploadImage(
  kind: UploadKind,
  picked: PickedImage,
  clientId?: string
): Promise<{ url: string; id: number | null }> {
  const form = new FormData();
  // RN 的 FormData 接受 { uri, name, type } 形态的文件对象
  // name 的扩展名与 type 保持一致：服务端会按 type 校验，两边对不上容易被判成非法类型
  const ext = extForMime(picked.mimeType);
  form.append("file", { uri: picked.uri, name: "upload." + ext, type: picked.mimeType } as unknown as Blob);
  form.append("kind", kind);
  if (clientId) form.append("clientId", clientId);
  const token = useAppStore.getState().token;
  const res = await fetch(getApiUrl() + "/api/uploads", {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(typeof data?.error === "string" ? data.error : "上传失败，请重试");
  }
  const data = await res.json();
  return { url: String(data?.upload?.url ?? ""), id: Number(data?.upload?.id) || null };
}

/**
 * 选图 + 上传一步到位（用户取消返回 null）。
 * 保留旧语义：不走发件箱、失败直接抛错。需要「离线不丢图」请用 `pickAndUploadPhoto`。
 */
export async function pickAndUpload(kind: UploadKind): Promise<string | null> {
  const picked = await pickImage();
  if (!picked) return null;
  const { url } = await uploadImage(kind, picked);
  return url || null;
}

/** 选图结果：直接传成功 / 已落本机待补发 / 用户取消 */
export type PhotoUploadResult =
  | { status: "uploaded"; url: string }
  | { status: "queued"; clientId: string; localUri: string }
  | { status: "canceled" };

/**
 * 选图 + 落本机 + 上传（组一 · 阶段 1）。
 *
 * 与 `pickAndUpload` 的区别：
 *  - 先把图复制到 document 目录并**入队**，再尝试上传 —— 杀进程 / 离线都不丢图；
 *  - 离线、5xx、401 等可重试失败返回 `{ status: "queued" }`，由 sync-engine 联网后补发；
 *  - 4xx（格式 / 容量 / 校验）丢弃并抛错，让用户看到服务端原因。
 */
export async function pickAndUploadPhoto(kind: UploadKind): Promise<PhotoUploadResult> {
  const picked = await pickImage();
  if (!picked) return { status: "canceled" };

  const clientId = makeClientId();
  const fileUri = await persistPickedImage(picked.uri, picked.mimeType, clientId);
  const op = makeUploadOp({ clientId, kind, fileUri, mimeType: picked.mimeType, displayUri: picked.uri });

  // 先入队再上传：即使上传中途崩溃，重启后仍能补发（clientId 保证不重复落两份）
  await saveOutbox(enqueue(await loadOutbox(), op));

  const result = await sendUploadOp(op, useAppStore.getState().token);
  if (result.ok) {
    await saveOutbox(removeByUri(await loadOutbox(), op.clientId).state);
    void removeLocalFile(fileUri);
    return { status: "uploaded", url: result.url };
  }

  const { outcome } = result;
  // 4xx（格式 / 容量 / 校验）：重试永远不会成功，出队并抛错让用户看到服务端原因
  if (toFlushOutcome(outcome) === "drop" && !outcome.ok) {
    await saveOutbox(removeByUri(await loadOutbox(), op.clientId).state);
    void removeLocalFile(fileUri);
    throw new Error(outcome.message ?? "上传失败，请重试");
  }

  return { status: "queued", clientId, localUri: fileUri };
}

/** 取消一条待补发的图片（换图 / 删图时调用）：出队并删本机副本 */
export async function cancelPendingUpload(ref: string): Promise<void> {
  const { state, removed } = removeByUri(await loadOutbox(), ref);
  if (removed.length === 0) return;
  await saveOutbox(state);
  await Promise.all(removed.map((op: UploadOp) => removeLocalFile(op.fileUri)));
}

/** 删除自己的图片（换图时清理，失败静默）；同时清掉指向它的待发送项 */
export async function deleteUpload(url: string): Promise<void> {
  await cancelPendingUpload(url);
  try {
    const token = useAppStore.getState().token;
    await fetch(getApiUrl() + "/api/uploads?url=" + encodeURIComponent(url), {
      method: "DELETE",
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
  } catch {
    // 忽略
  }
}
