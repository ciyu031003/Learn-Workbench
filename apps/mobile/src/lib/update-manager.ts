import * as LegacyFileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { hashFileSha256, readFileSize } from "./file-hash";

/**
 * OTA 应用内升级的核心（下载 / 续传 / 校验 / 安装）。
 *
 * 与旧实现（`Linking.openURL(apkUrl)` 跳浏览器）的区别：全程停在 App 内，
 * 有进度、能暂停续传、装完直接进系统安装器，且**覆盖安装不清数据**（登录态自动保留）。
 */
export const APK_PACKAGE_NAME = "com.yuanabd.learnworkbench";

const UPDATE_DIR = (LegacyFileSystem.cacheDirectory ?? "") + "updates/";

export interface DownloadProgressInfo {
  bytesWritten: number;
  totalBytes: number;
  /** 0–1（总大小未知时为 0） */
  ratio: number;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  size: number;
  sha256?: string;
  /** sha256 是否真的比对了（读文件失败时会退化为仅校验大小） */
  sha256Checked: boolean;
}

type DownloadResumable = ReturnType<typeof LegacyFileSystem.createDownloadResumable>;

function sanitize(versionName: string): string {
  return versionName.replace(/[^0-9A-Za-z._-]/g, "");
}

export function apkUriFor(versionName: string): string {
  return UPDATE_DIR + "learn-workbench-" + sanitize(versionName) + ".apk";
}

export async function ensureUpdateDir(): Promise<void> {
  const info = await LegacyFileSystem.getInfoAsync(UPDATE_DIR);
  if (!info.exists) await LegacyFileSystem.makeDirectoryAsync(UPDATE_DIR, { intermediates: true });
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

export async function removeApk(uri: string): Promise<void> {
  try {
    await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // 清理失败不影响升级流程
  }
}

/** 可暂停 / 续传的 APK 下载器 */
export class ApkDownloader {
  private resumable: DownloadResumable | null = null;
  private progress: DownloadProgressInfo = { bytesWritten: 0, totalBytes: 0, ratio: 0 };

  constructor(
    private readonly url: string,
    private readonly destination: string,
    private readonly onProgress?: (progress: DownloadProgressInfo) => void
  ) {}

  get lastProgress(): DownloadProgressInfo {
    return this.progress;
  }

  private handle = (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
    const totalBytes = data.totalBytesExpectedToWrite > 0 ? data.totalBytesExpectedToWrite : 0;
    this.progress = {
      bytesWritten: data.totalBytesWritten,
      totalBytes,
      ratio: totalBytes > 0 ? Math.min(1, data.totalBytesWritten / totalBytes) : 0,
    };
    this.onProgress?.(this.progress);
  };

  /** 开始下载；返回 true=已完成，false=被暂停 */
  async start(): Promise<boolean> {
    await ensureUpdateDir();
    if (!this.resumable) {
      this.resumable = LegacyFileSystem.createDownloadResumable(this.url, this.destination, {}, this.handle);
    }
    const result = await this.resumable.downloadAsync();
    return Boolean(result?.uri);
  }

  async pause(): Promise<void> {
    if (!this.resumable) return;
    try {
      await this.resumable.pauseAsync();
    } catch {
      // 已经结束/未开始时忽略
    }
  }

  async resume(): Promise<boolean> {
    if (!this.resumable) return this.start();
    const result = await this.resumable.resumeAsync();
    return Boolean(result?.uri);
  }

  async cancel(): Promise<void> {
    const resumable = this.resumable;
    this.resumable = null;
    if (resumable) {
      try {
        await resumable.pauseAsync();
      } catch {
        // 忽略
      }
    }
    await removeApk(this.destination);
  }
}

/** 校验：大小必须严格一致；sha256 能算就算，算不了就退化为「仅大小校验」 */
export async function verifyApk(
  uri: string,
  expected: { sizeBytes?: number; sha256?: string },
  onProgress?: (hashedBytes: number, totalBytes: number) => void
): Promise<VerifyResult> {
  const size = await readFileSize(uri);
  if (size <= 0) return { ok: false, reason: "安装包不存在或为空，请重新下载", size: 0, sha256Checked: false };
  if (expected.sizeBytes && expected.sizeBytes > 0 && size !== expected.sizeBytes) {
    return {
      ok: false,
      reason: "安装包大小不符（" + size + " / " + expected.sizeBytes + "），请重新下载",
      size,
      sha256Checked: false,
    };
  }
  if (!expected.sha256) return { ok: true, size, sha256Checked: false };
  try {
    const actual = await hashFileSha256(uri, size, onProgress);
    if (actual.toLowerCase() !== expected.sha256.toLowerCase()) {
      return { ok: false, reason: "安装包校验失败（sha256 不一致），请重新下载", size, sha256: actual, sha256Checked: true };
    }
    return { ok: true, size, sha256: actual, sha256Checked: true };
  } catch {
    // 读文件失败：不阻塞安装（大小已核对），但把情况说明白
    return { ok: true, size, sha256Checked: false, reason: "sha256 校验不可用，已按文件大小校验" };
  }
}

/** 调起系统安装器（同签名覆盖安装，数据与登录态保留） */
export async function installApk(uri: string): Promise<void> {
  const contentUri = await LegacyFileSystem.getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    type: "application/vnd.android.package-archive",
    // FLAG_GRANT_READ_URI_PERMISSION：把 content:// 的读权限授给安装器
    flags: 1,
  });
}

/** 引导用户到「安装未知应用」授权页 */
export async function openUnknownSourcesSettings(packageName = APK_PACKAGE_NAME): Promise<void> {
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, {
    data: "package:" + packageName,
  });
}

/** 是否像「没有安装未知应用权限」的报错 */
export function isInstallPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unknown source|not allowed|SecurityException|INSTALL_FAILED|permission/i.test(message);
}
