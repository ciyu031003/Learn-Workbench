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

/**
 * 下载失败的用户文案（S6-7）：按真实能力写 —— 本下载器支持暂停/续传，
 * 所以「继续下载」失败时提示重新下载（而不是谎称支持断点续传/秒传）。
 */
export function describeDownloadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/network|timeout|timed out|socket|ECONN|ENET|unreachable|network error/i.test(message)) {
    return "网络中断，下载失败，请重新下载";
  }
  if (/enospc|no space|磁盘|storage/i.test(message)) {
    return "存储空间不足，下载失败，请清理后重新下载";
  }
  if (/403|404|410|not found|forbidden/i.test(message)) {
    return "安装包地址失效（可能已发布新版本），请重新下载";
  }
  return "下载失败，请重新下载";
}

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
    try {
      const result = await this.resumable.downloadAsync();
      return Boolean(result?.uri);
    } catch (error) {
      // 半包保留在缓存里也没用（下次会重新下载覆盖），文案统一按「重新下载」
      throw new Error(describeDownloadError(error));
    }
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
    try {
      const result = await this.resumable.resumeAsync();
      return Boolean(result?.uri);
    } catch (error) {
      throw new Error(describeDownloadError(error));
    }
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

/**
 * 校验：大小必须严格一致；sha256 **必须**提供且必须匹配（S6-7 起清单强制 sha256）。
 * 读文件/计算失败也判失败（fail closed）—— 宁可让用户重新下载，也不装未校验的包。
 */
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
  const expectedSha = expected.sha256?.trim().toLowerCase();
  if (!expectedSha || !/^[0-9a-f]{64}$/.test(expectedSha)) {
    return { ok: false, reason: "清单缺少 sha256 校验值，已拒绝安装，请重新下载", size, sha256Checked: false };
  }
  try {
    const actual = await hashFileSha256(uri, size, onProgress);
    if (actual.toLowerCase() !== expectedSha) {
      return { ok: false, reason: "安装包校验失败（sha256 不一致），请重新下载", size, sha256: actual, sha256Checked: true };
    }
    return { ok: true, size, sha256: actual, sha256Checked: true };
  } catch {
    return { ok: false, reason: "sha256 计算失败（文件读取异常），请重新下载", size, sha256Checked: false };
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
