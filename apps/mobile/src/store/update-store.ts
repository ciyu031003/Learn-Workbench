import { create } from "zustand";
import { APP_VERSION_NAME, checkForUpdate, clearPendingUpdate, ignoreVersionCode, type PendingUpdate } from "@/lib/ota";
import {
  ApkDownloader,
  apkUriFor,
  installApk,
  isInstallPermissionError,
  openUnknownSourcesSettings,
  removeApk,
  verifyApk,
  type DownloadProgressInfo,
} from "@/lib/update-manager";

/**
 * 应用内升级状态机（v11 · 用户要求：不跳浏览器、有进度条、下载完直接安装）。
 *
 * 一个下载器实例（模块级）串起 download → verify → install，UI 只读 store。
 */
export type UpdatePhase =
  | "idle"
  | "available"
  | "downloading"
  | "paused"
  | "verifying"
  | "ready"
  | "installing"
  | "error";

export interface UpdateTarget {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  releaseNotes: string[];
  sizeBytes?: number;
  sha256?: string;
}

const ZERO: DownloadProgressInfo = { bytesWritten: 0, totalBytes: 0, ratio: 0 };

let downloader: ApkDownloader | null = null;

export interface UpdateStoreState {
  visible: boolean;
  phase: UpdatePhase;
  target: UpdateTarget | null;
  progress: DownloadProgressInfo;
  error: string | null;
  notice: string | null;
  apkUri: string | null;
  checking: boolean;
  /** 检查更新；silent=true 时不打扰（启动静默检查用） */
  check: (options?: { silent?: boolean }) => Promise<"available" | "latest" | "error">;
  /** 用启动静默检查落盘的结果直接弹层（不再重复请求清单） */
  promptFromPending: (pending: PendingUpdate) => void;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
  ignore: () => Promise<void>;
  retry: () => void;
}

export const useUpdateStore = create<UpdateStoreState>((set, get) => {
  /** 下载完成后的校验 + 就绪（下载与续传共用） */
  const verifyAndReady = async (uri: string) => {
    const target = get().target;
    if (!target) return;
    set({ phase: "verifying", error: null });
    const result = await verifyApk(
      uri,
      { sizeBytes: target.sizeBytes, sha256: target.sha256 },
      (hashedBytes, totalBytes) => set({ progress: { bytesWritten: hashedBytes, totalBytes, ratio: totalBytes > 0 ? hashedBytes / totalBytes : 0 } })
    );
    if (!result.ok) {
      await removeApk(uri);
      set({ phase: "error", error: result.reason ?? "安装包校验失败，请重试", apkUri: null });
      return;
    }
    set({ phase: "ready", apkUri: uri, notice: result.reason ?? null });
  };

  return {
    visible: false,
    phase: "idle",
    target: null,
    progress: ZERO,
    error: null,
    notice: null,
    apkUri: null,
    checking: false,

    check: async (options) => {
      set({ checking: true });
      try {
        const result = await checkForUpdate();
        if (!result.hasUpdate) {
          set({ checking: false, notice: options?.silent ? null : "已是最新版本 v" + APP_VERSION_NAME });
          return "latest";
        }
        set({
          checking: false,
          visible: true,
          phase: "available",
          notice: null,
          error: null,
          progress: ZERO,
          apkUri: null,
          target: {
            versionName: result.latestVersionName,
            versionCode: result.latestVersionCode,
            apkUrl: result.apkUrl ?? "",
            releaseNotes: result.releaseNotes ?? [],
            sizeBytes: result.sizeBytes,
            sha256: result.sha256,
          },
        });
        return "available";
      } catch {
        set({ checking: false, notice: options?.silent ? null : "检查更新失败，请检查网络" });
        return "error";
      }
    },

    promptFromPending: (pending) => {
      if (!pending.apkUrl) return;
      set({
        visible: true,
        phase: "available",
        notice: null,
        error: null,
        progress: ZERO,
        apkUri: null,
        target: {
          versionName: pending.versionName,
          versionCode: pending.versionCode,
          apkUrl: pending.apkUrl,
          releaseNotes: pending.releaseNotes ?? [],
          sizeBytes: pending.sizeBytes,
          sha256: pending.sha256,
        },
      });
    },

    start: async () => {
      const target = get().target;
      if (!target?.apkUrl) return;
      const destination = apkUriFor(target.versionName);
      downloader = new ApkDownloader(target.apkUrl, destination, (progress) => set({ progress }));
      set({ phase: "downloading", error: null, notice: null, progress: { bytesWritten: 0, totalBytes: target.sizeBytes ?? 0, ratio: 0 } });
      try {
        const done = await downloader.start();
        if (!done) {
          set({ phase: "paused" });
          return;
        }
        await verifyAndReady(destination);
      } catch (error) {
        set({ phase: "error", error: error instanceof Error ? error.message : "下载失败，请重试" });
      }
    },

    pause: async () => {
      await downloader?.pause();
      set({ phase: "paused" });
    },

    resume: async () => {
      const target = get().target;
      if (!target) return;
      const destination = apkUriFor(target.versionName);
      set({ phase: "downloading", error: null });
      try {
        if (!downloader) {
          downloader = new ApkDownloader(target.apkUrl, destination, (progress) => set({ progress }));
          const done = await downloader.start();
          if (!done) {
            set({ phase: "paused" });
            return;
          }
        } else {
          const done = await downloader.resume();
          if (!done) {
            set({ phase: "paused" });
            return;
          }
        }
        await verifyAndReady(destination);
      } catch (error) {
        set({ phase: "error", error: error instanceof Error ? error.message : "继续下载失败" });
      }
    },

    cancel: async () => {
      const target = get().target;
      await downloader?.cancel();
      downloader = null;
      if (target) await removeApk(apkUriFor(target.versionName));
      set({ phase: "available", progress: ZERO, apkUri: null, error: null, notice: null });
    },

    install: async () => {
      const uri = get().apkUri;
      if (!uri) return;
      set({ phase: "installing", error: null, notice: null });
      try {
        await installApk(uri);
        await clearPendingUpdate();
        set({ phase: "ready", notice: "已打开系统安装器，按提示完成安装即可（数据与登录状态保留）" });
      } catch (error) {
        if (isInstallPermissionError(error)) {
          set({ phase: "error", error: "需要先允许本应用「安装未知应用」，已为你打开设置页" });
          await openUnknownSourcesSettings().catch(() => {});
        } else {
          set({ phase: "error", error: error instanceof Error ? error.message : "无法调起安装器，可改用浏览器下载" });
        }
      }
    },

    dismiss: () => set({ visible: false }),

    ignore: async () => {
      const target = get().target;
      if (target) {
        await ignoreVersionCode(target.versionCode);
        await removeApk(apkUriFor(target.versionName));
        await clearPendingUpdate();
      }
      downloader = null;
      set({ visible: false, phase: "idle", target: null, apkUri: null, progress: ZERO, error: null, notice: null });
    },

    retry: () => set({ phase: "available", error: null, progress: ZERO, apkUri: null }),
  };
});
