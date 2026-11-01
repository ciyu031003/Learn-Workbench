import { NativeModules, Platform } from "react-native";
import type { DownloadProgressInfo } from "./update-manager";

/**
 * Android 系统 DownloadManager 的 JS 半边（v1.58.0 P10）。
 *
 * 为什么存在：老的 ApkDownloader（update-manager.ts）用 expo-file-system 在 JS 线程里前台下载，
 * 熄屏/切后台会被系统冻结 → 连接断开，用户看到「下载失败」。这里改成把 URL 交给系统
 * DownloadManager：下载在 system_server 里跑，熄屏不断、通知栏有进度，任务落库后
 * App 重启仍能按 id 认领（见 update-store 的 adoptPendingBackgroundDownload）。
 *
 * 平台边界：只有 Android 且原生模块存在时启用；iOS / 未注入模块 / Web 一律返回 null，
 * 调用方继续走原有 expo-file-system 路径（行为完全不变）。
 *
 * 文件落点：系统先下载到 app-specific 外部目录 files/Download/updates/<fileName>，
 * JS 拿到 localUri 后复制到 cacheDirectory/updates/<与 apkUriFor 同名>，再走既有
 * verifyApk（大小 + sha256）→ installApk。校验一步都不能省。
 */

export const BACKGROUND_DOWNLOAD_MODULE_NAME = "BackgroundDownload";
/** 轮询间隔：1s（DownloadManager 没有回调，只能查；1s 对 60MB 包足够平滑且开销可控） */
export const BACKGROUND_POLL_INTERVAL_MS = 1000;
/** 未完成下载的认领记录（App 重启后据此 query 系统任务） */
export const PENDING_BACKGROUND_DOWNLOAD_KEY = "lwb.ota.backgroundDownload.v1";

export type BackgroundDownloadStatus =
  | "pending"
  | "running"
  | "paused"
  | "successful"
  | "failed"
  | "unknown";

export interface BackgroundDownloadSnapshot {
  status: BackgroundDownloadStatus;
  downloadedBytes: number;
  totalBytes: number;
  /** 下载成功后可读的本地地址（file://... 或 content://...），运行中为 null */
  localUri: string | null;
  /** 失败原因码（见 describeBackgroundDownloadFailure），非失败状态为 "none" */
  reason: string | null;
}

export interface BackgroundDownloadNative {
  enqueue(url: string, fileName: string, title: string, description: string): Promise<number>;
  query(id: number): Promise<BackgroundDownloadSnapshot | null>;
  cancel(id: number): Promise<boolean>;
  clear(id: number): Promise<void>;
}

/** App 重启后用来「认领」系统任务的记录（比任务要求多存 sha256/size，重启后仍能校验） */
export interface PendingBackgroundDownload {
  id: number;
  versionName: string;
  versionCode: number;
  apkUrl: string;
  sizeBytes?: number;
  sha256?: string;
  releaseNotes?: string[];
  startedAt: string;
}

const STATUSES: readonly BackgroundDownloadStatus[] = [
  "pending",
  "running",
  "paused",
  "successful",
  "failed",
  "unknown",
];

function isStatus(value: unknown): value is BackgroundDownloadStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 从 NativeModules 里解析原生模块（可注入，便于单测）。
 * 缺任意一个方法都视为不可用 —— 宁可直接走老路径，也不要半残调用抛 undefined。
 */
export function resolveBackgroundDownload(
  nativeModules: unknown = NativeModules,
): BackgroundDownloadNative | null {
  if (Platform.OS !== "android") return null;
  if (!nativeModules || typeof nativeModules !== "object") return null;
  const candidate = (nativeModules as Record<string, unknown>)[BACKGROUND_DOWNLOAD_MODULE_NAME];
  if (!candidate || typeof candidate !== "object") return null;
  const module = candidate as Partial<BackgroundDownloadNative>;
  if (
    typeof module.enqueue !== "function" ||
    typeof module.query !== "function" ||
    typeof module.cancel !== "function" ||
    typeof module.clear !== "function"
  ) {
    return null;
  }
  return module as BackgroundDownloadNative;
}

export function getBackgroundDownload(): BackgroundDownloadNative | null {
  return resolveBackgroundDownload();
}

/** Android 且有原生模块时才走后台下载（iOS 保持原逻辑） */
export function isBackgroundDownloadAvailable(): boolean {
  return getBackgroundDownload() !== null;
}

/** 与 update-manager.apkUriFor 的清洗规则一致：通知栏/下载目录里的文件名可预测 */
export function backgroundDownloadFileName(versionName: string): string {
  const safe = String(versionName ?? "").replace(/[^0-9A-Za-z._-]/g, "");
  return "learn-workbench-" + (safe || "update") + ".apk";
}

/** 原生快照 → 通用进度（totalBytes 未知时 ratio 记 0，UI 显示百分比前会判 >0） */
export function backgroundDownloadProgress(
  snapshot: BackgroundDownloadSnapshot | null,
): DownloadProgressInfo {
  if (!snapshot) return { bytesWritten: 0, totalBytes: 0, ratio: 0 };
  const bytesWritten = toNumber(snapshot.downloadedBytes);
  const totalBytes = toNumber(snapshot.totalBytes);
  return {
    bytesWritten,
    totalBytes,
    ratio: totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : 0,
  };
}

/** 还在跑（含系统因断网自动暂停）：UI 显示「后台下载中」并继续轮询 */
export function isBackgroundDownloadActive(status: BackgroundDownloadStatus): boolean {
  return status === "pending" || status === "running" || status === "paused";
}

/**
 * 原生返回值的容错解析：字段可能是 null / 字符串数字 / 未来新增的状态，
 * 一律收敛成 BackgroundDownloadSnapshot；拿不到任务时返回 null（= 记录已被系统清理）。
 */
export function normalizeBackgroundSnapshot(raw: unknown): BackgroundDownloadSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const localUri = typeof value.localUri === "string" && value.localUri.length > 0 ? value.localUri : null;
  return {
    status: isStatus(value.status) ? value.status : "unknown",
    downloadedBytes: toNumber(value.downloadedBytes),
    totalBytes: toNumber(value.totalBytes),
    localUri,
    reason: typeof value.reason === "string" && value.reason.length > 0 ? value.reason : null,
  };
}

/**
 * 失败原因码 → 用户可执行文案。
 * 与 BackgroundDownloadModule.kt 的 reasonName() 同一张表（两边都改，别只改一处）；
 * 「网络/空间/地址失效」三类短语与 update-manager.describeDownloadError 保持一致，用户无感替换。
 */
export function describeBackgroundDownloadFailure(snapshot: BackgroundDownloadSnapshot | null): string {
  if (!snapshot) return "下载任务已丢失（可能被系统下载管理器清理），请重新下载";
  const reason = (snapshot.reason ?? "").toLowerCase();
  if (reason === "network" || reason === "network_not_available") {
    return "网络中断，下载失败，请重新下载";
  }
  if (reason === "insufficient_space") {
    return "存储空间不足，下载失败，请清理后重新下载";
  }
  if (
    reason === "unhandled_http_code" ||
    reason === "too_many_redirects" ||
    /^http_(403|404|410)$/.test(reason)
  ) {
    return "安装包地址失效（可能已发布新版本），请重新下载";
  }
  if (reason === "file_error" || reason === "file_already_exists") {
    return "本地文件写入失败，请重新下载";
  }
  if (reason === "cannot_resume" || reason === "blocked" || reason === "device_not_found") {
    return "下载被系统中断，请重新下载";
  }
  return "下载失败，请重新下载";
}

async function asyncStorage(): Promise<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null> {
  try {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    return AsyncStorage;
  } catch {
    return null;
  }
}

/** 落盘「正在后台下载」的记录（App 被杀后靠它认领） */
export async function savePendingBackgroundDownload(record: PendingBackgroundDownload): Promise<boolean> {
  const storage = await asyncStorage();
  if (!storage) return false;
  try {
    await storage.setItem(PENDING_BACKGROUND_DOWNLOAD_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** 读取认领记录（格式非法/过期数据一律当没有） */
export async function readPendingBackgroundDownload(): Promise<PendingBackgroundDownload | null> {
  const storage = await asyncStorage();
  if (!storage) return null;
  try {
    const raw = await storage.getItem(PENDING_BACKGROUND_DOWNLOAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBackgroundDownload>;
    const id = Number(parsed.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (typeof parsed.versionName !== "string" || !parsed.versionName) return null;
    if (typeof parsed.apkUrl !== "string" || !parsed.apkUrl) return null;
    return {
      id,
      versionName: parsed.versionName,
      versionCode: Number.isFinite(Number(parsed.versionCode)) ? Number(parsed.versionCode) : 0,
      apkUrl: parsed.apkUrl,
      sizeBytes:
        Number.isFinite(Number(parsed.sizeBytes)) && Number(parsed.sizeBytes) > 0
          ? Number(parsed.sizeBytes)
          : undefined,
      sha256: typeof parsed.sha256 === "string" && parsed.sha256 ? parsed.sha256 : undefined,
      releaseNotes: Array.isArray(parsed.releaseNotes)
        ? parsed.releaseNotes.filter((note): note is string => typeof note === "string")
        : undefined,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function clearPendingBackgroundDownload(): Promise<void> {
  const storage = await asyncStorage();
  if (!storage) return;
  try {
    await storage.removeItem(PENDING_BACKGROUND_DOWNLOAD_KEY);
  } catch {
    // 清理失败不影响升级流程
  }
}
