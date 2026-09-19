import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { gearKindFromLabel } from "@learn-workbench/shared";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";

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
    quality: 0.92,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
}

/** 上传一张图；失败抛错（调用方展示文案） */
export async function uploadImage(
  kind: UploadKind,
  picked: PickedImage
): Promise<{ url: string; id: number | null }> {
  const form = new FormData();
  // RN 的 FormData 接受 { uri, name, type } 形态的文件对象
  form.append("file", { uri: picked.uri, name: "upload.jpg", type: picked.mimeType } as unknown as Blob);
  form.append("kind", kind);
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

/** 选图 + 上传一步到位（用户取消返回 null） */
export async function pickAndUpload(kind: UploadKind): Promise<string | null> {
  const picked = await pickImage();
  if (!picked) return null;
  const { url } = await uploadImage(kind, picked);
  return url || null;
}

/** 删除自己的图片（换图时清理，失败静默） */
export async function deleteUpload(url: string): Promise<void> {
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
