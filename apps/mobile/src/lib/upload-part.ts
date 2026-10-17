import { File } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export function extForUploadMime(mimeType: string, fallback = "bin"): string {
  return MIME_EXT[mimeType.toLowerCase()] ?? fallback;
}

export interface UploadPart {
  /** expo/fetch 能接受的 multipart 部件（expo-file-system 的 File 实现了 bytes() 与 Blob 接口） */
  part: Blob;
  /** 带正确扩展名的文件名，服务端按它校验类型 */
  filename: string;
}

/**
 * 把本地文件包成 **expo/fetch 能接受** 的 multipart 部件。
 *
 * 为什么要这么绕（真机 v1.47 复现的 bug）：
 *  1. Expo SDK 54+ 的全局 fetch 是 expo/fetch，其 convertFormData 只认
 *     `Blob` 或**带 bytes() 的对象**；React Native 传统写法
 *     `form.append("file", { uri, name, type })` 会直接抛
 *     `Unsupported FormDataPart implementation` —— 这就是「简历上传失败」和
 *     「运动档案提示网络不顺、实际没上传」的**同一个根因**。
 *  2. expo-file-system 的 File 的 name/type 来自**真实路径的扩展名**。图片选择器
 *     与文件选择器给的 URI 经常没扩展名或扩展名不对（安卓各文件提供方尤其明显），
 *     服务端按扩展名校验就会 400。所以先按目标扩展名复制到 cache，再做 File。
 */
export async function makeUploadPart(
  uri: string,
  mimeType: string,
  desiredName?: string
): Promise<UploadPart> {
  const ext = extForUploadMime(mimeType);
  const filename =
    desiredName && /.[a-z0-9]+$/i.test(desiredName)
      ? desiredName
      : (desiredName?.replace(/.[a-z0-9]+$/i, "").trim() || "upload") + "." + ext;

  let path = uri;
  try {
    const target = (LegacyFileSystem.cacheDirectory ?? "") + "upload-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    await LegacyFileSystem.copyAsync({ from: uri, to: target });
    path = target;
  } catch {
    // 复制失败就退回原路径（至少比完全不传强，name/type 可能不准）
    path = uri;
  }

  return { part: new File(path) as unknown as Blob, filename };
}
