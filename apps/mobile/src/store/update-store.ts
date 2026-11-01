import { create } from "zustand";
import { APP_VERSION_NAME, checkForUpdate, clearPendingUpdate, ignoreVersionCode, isNewer, type PendingUpdate } from "@/lib/ota";
import {
  ApkDownloader,
  apkUriFor,
  importDownloadedApk,
  installApk,
  isInstallPermissionError,
  openUnknownSourcesSettings,
  removeApk,
  removeDownloadedSource,
  verifyApk,
  type DownloadProgressInfo,
} from "@/lib/update-manager";
import {
  BACKGROUND_POLL_INTERVAL_MS,
  backgroundDownloadFileName,
  backgroundDownloadProgress,
  clearPendingBackgroundDownload,
  describeBackgroundDownloadFailure,
  getBackgroundDownload,
  isBackgroundDownloadActive,
  isBackgroundDownloadAvailable,
  normalizeBackgroundSnapshot,
  readPendingBackgroundDownload,
  savePendingBackgroundDownload,
  type BackgroundDownloadSnapshot,
} from "@/lib/background-download";

/**
 * 应用内升级状态机（v11 · 用户要求：不跳浏览器、有进度条、下载完直接安装）。
 *
 * v1.58.0 P10（Android）：下载改走**系统 DownloadManager**——
 *   - 熄屏 / 切后台 / 划掉最近任务都不断流（老实现是 JS 线程前台下载，灭屏即断）；
 *   - 通知栏有系统进度与完成通知；
 *   - 任务落库，App 被杀后重启能按 id「认领」（adoptPendingBackgroundDownload）。
 * iOS / 未注入原生模块时，仍走原来的 expo-file-system 可续传下载器，行为不变。
 *
 * 一个下载会话（模块级）串起 download → 校验 → 安装，UI 只读 store。
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
/** 当前后台下载的系统任务（id + 文件名），null 表示没有后台会话 */
let backgroundSession: { id: number; fileName: string } | null = null;
let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

export interface UpdateStoreState {
  visible: boolean;
  phase: UpdatePhase;
  target: UpdateTarget | null;
  progress: DownloadProgressInfo;
  error: string | null;
  notice: string | null;
  apkUri: string | null;
  checking: boolean;
  /** 当前会话是否走系统后台下载（UI 据此换文案：暂停/继续 → 取消/重试） */
  background: boolean;
  /** 检查更新；silent=true 时不打扰（启动静默检查用） */
  check: (options?: { silent?: boolean }) => Promise<"available" | "latest" | "error">;
  /** 用启动静默检查落盘的结果直接弹层（不再重复请求清单） */
  promptFromPending: (pending: PendingUpdate) => void;
  /** App 启动时认领未完成/已完成的后台下载（Android） */
  adoptPendingBackgroundDownload: () => Promise<void>;
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
      set({ phase: "error", error: result.reason ?? "安装包校验失败，请重试", apkUri: null, background: false });
      return;
    }
    set({ phase: "ready", apkUri: uri, notice: result.reason ?? null });
  };

  /* -------------------- 后台下载（DownloadManager） -------------------- */

  const stopBackgroundTimer = () => {
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
  };

  const scheduleBackgroundPoll = () => {
    stopBackgroundTimer();
    backgroundTimer = setTimeout(() => {
      void pollBackground();
    }, BACKGROUND_POLL_INTERVAL_MS);
  };

  /** 后台下载失败/记录丢失：清会话与落盘记录，给可执行文案 */
  const failBackground = async (message: string) => {
    stopBackgroundTimer();
    backgroundSession = null;
    await clearPendingBackgroundDownload();
    set({ phase: "error", error: message, background: false });
  };

  /**
   * 下载完成：把系统下载的包搬进 cache → 校验 → 就绪 → **自动调起安装器**。
   * 自动安装是本次需求（完成后跳安装）；若用户已关掉弹层就只停在 ready，不强行抢焦点。
   */
  const completeBackground = async (snapshot: BackgroundDownloadSnapshot) => {
    const target = get().target;
    const session = backgroundSession;
    stopBackgroundTimer();
    if (!target || !session) return;
    if (!snapshot.localUri) {
      await failBackground("下载完成但拿不到文件地址，请重新下载");
      return;
    }
    const destination = apkUriFor(target.versionName);
    try {
      const uri = await importDownloadedApk(snapshot.localUri, destination);
      const native = getBackgroundDownload();
      if (native) {
        // 清掉系统下载记录（避免下载管理器里堆历史条目）；失败不影响安装
        await native.clear(session.id).catch(() => undefined);
      }
      await removeDownloadedSource(snapshot.localUri === uri ? null : snapshot.localUri);
      await clearPendingBackgroundDownload();
      backgroundSession = null;
      await verifyAndReady(uri);
      if (get().visible && get().phase === "ready") {
        await get().install();
      }
    } catch (error) {
      await failBackground(error instanceof Error ? error.message : "后台下载完成后处理失败，请重试");
    }
  };

  const pollBackground = async () => {
    const session = backgroundSession;
    const native = getBackgroundDownload();
    if (!session || !native) return;
    let snapshot: BackgroundDownloadSnapshot | null = null;
    try {
      snapshot = normalizeBackgroundSnapshot(await native.query(session.id));
    } catch {
      snapshot = null;
    }
    if (!snapshot) {
      await failBackground("下载任务已丢失（可能被系统下载管理器清理），请重新下载");
      return;
    }
    if (isBackgroundDownloadActive(snapshot.status)) {
      set({ progress: backgroundDownloadProgress(snapshot) });
      scheduleBackgroundPoll();
      return;
    }
    if (snapshot.status === "successful") {
      await completeBackground(snapshot);
      return;
    }
    if (snapshot.status === "failed") {
      await failBackground(describeBackgroundDownloadFailure(snapshot));
      return;
    }
    // unknown：系统还没给出稳定状态（少见），继续轮询
    set({ progress: backgroundDownloadProgress(snapshot) });
    scheduleBackgroundPoll();
  };

  /** 入队系统下载任务并开始轮询（Android 后台模式） */
  const startBackground = async (target: UpdateTarget) => {
    const native = getBackgroundDownload();
    if (!native) return false;
    stopBackgroundTimer();
    await clearPendingBackgroundDownload();
    set({
      phase: "downloading",
      background: true,
      error: null,
      notice: null,
      progress: { bytesWritten: 0, totalBytes: target.sizeBytes ?? 0, ratio: 0 },
    });
    try {
      const fileName = backgroundDownloadFileName(target.versionName);
      const id = Number(
        await native.enqueue(
          target.apkUrl,
          fileName,
          "苦旅 v" + target.versionName,
          "后台下载中 · 熄屏不中断，完成后自动打开安装器"
        )
      );
      if (!Number.isFinite(id) || id <= 0) throw new Error("系统下载任务创建失败，请重试");
      backgroundSession = { id, fileName };
      await savePendingBackgroundDownload({
        id,
        versionName: target.versionName,
        versionCode: target.versionCode,
        apkUrl: target.apkUrl,
        sizeBytes: target.sizeBytes,
        sha256: target.sha256,
        releaseNotes: target.releaseNotes,
        startedAt: new Date().toISOString(),
      });
      scheduleBackgroundPoll();
      return true;
    } catch (error) {
      await failBackground(error instanceof Error ? error.message : "后台下载启动失败，请重试");
      return true;
    }
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
    background: false,

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
          background: false,
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
        background: false,
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

    adoptPendingBackgroundDownload: async () => {
      if (!isBackgroundDownloadAvailable()) return;
      if (backgroundSession) return; // 本次进程已经在跑，别重复认领
      const native = getBackgroundDownload();
      if (!native) return;
      const record = await readPendingBackgroundDownload();
      if (!record) return;
      // 版本已经装上去了（或记录过期）：清掉，别再打扰
      if (!isNewer(record.versionCode)) {
        await clearPendingBackgroundDownload();
        return;
      }
      let snapshot: BackgroundDownloadSnapshot | null = null;
      try {
        snapshot = normalizeBackgroundSnapshot(await native.query(record.id));
      } catch {
        snapshot = null;
      }
      if (!snapshot) {
        await clearPendingBackgroundDownload();
        return;
      }
      const target: UpdateTarget = {
        versionName: record.versionName,
        versionCode: record.versionCode,
        apkUrl: record.apkUrl,
        releaseNotes: record.releaseNotes ?? [],
        sizeBytes: record.sizeBytes,
        sha256: record.sha256,
      };
      set({
        visible: true,
        target,
        background: true,
        error: null,
        notice: null,
        phase: isBackgroundDownloadActive(snapshot.status) ? "downloading" : "verifying",
      });
      if (isBackgroundDownloadActive(snapshot.status)) {
        backgroundSession = { id: record.id, fileName: backgroundDownloadFileName(record.versionName) };
        set({ progress: backgroundDownloadProgress(snapshot) });
        scheduleBackgroundPoll();
        return;
      }
      if (snapshot.status === "successful") {
        backgroundSession = { id: record.id, fileName: backgroundDownloadFileName(record.versionName) };
        await completeBackground(snapshot);
        return;
      }
      // failed / unknown：不静默吞掉，弹层里给「重新下载」
      await clearPendingBackgroundDownload();
      set({ phase: "error", background: false, error: describeBackgroundDownloadFailure(snapshot) });
    },

    start: async () => {
      const target = get().target;
      if (!target?.apkUrl) return;
      if (isBackgroundDownloadAvailable()) {
        await startBackground(target);
        return;
      }
      const destination = apkUriFor(target.versionName);
      downloader = new ApkDownloader(target.apkUrl, destination, (progress) => set({ progress }));
      set({
        phase: "downloading",
        background: false,
        error: null,
        notice: null,
        progress: { bytesWritten: 0, totalBytes: target.sizeBytes ?? 0, ratio: 0 },
      });
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
      // DownloadManager 不支持暂停：后台模式下按钮已换成「取消下载」，这里只保护 iOS/老路径
      if (get().background) return;
      await downloader?.pause();
      set({ phase: "paused" });
    },

    resume: async () => {
      const target = get().target;
      if (!target) return;
      if (get().background) {
        // 后台模式没有"继续"语义：取消旧任务后重新入队（断网恢复由系统自己续传，一般用不到）
        await get().cancel();
        await startBackground(target);
        return;
      }
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
      stopBackgroundTimer();
      if (backgroundSession) {
        const native = getBackgroundDownload();
        const session = backgroundSession;
        backgroundSession = null;
        if (native) await native.cancel(session.id).catch(() => undefined);
        await clearPendingBackgroundDownload();
      }
      await downloader?.cancel();
      downloader = null;
      if (target) await removeApk(apkUriFor(target.versionName));
      set({ phase: "available", progress: ZERO, apkUri: null, error: null, notice: null, background: false });
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
      stopBackgroundTimer();
      if (backgroundSession) {
        const native = getBackgroundDownload();
        const session = backgroundSession;
        backgroundSession = null;
        if (native) await native.cancel(session.id).catch(() => undefined);
        await clearPendingBackgroundDownload();
      }
      if (target) {
        await ignoreVersionCode(target.versionCode);
        await removeApk(apkUriFor(target.versionName));
        await clearPendingUpdate();
      }
      downloader = null;
      set({ visible: false, phase: "idle", target: null, apkUri: null, progress: ZERO, error: null, notice: null, background: false });
    },

    retry: () => set({ phase: "available", error: null, progress: ZERO, apkUri: null, background: false }),
  };
});
