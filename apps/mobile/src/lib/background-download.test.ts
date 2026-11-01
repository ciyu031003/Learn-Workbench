import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BACKGROUND_DOWNLOAD_MODULE_NAME,
  PENDING_BACKGROUND_DOWNLOAD_KEY,
  backgroundDownloadFileName,
  backgroundDownloadProgress,
  clearPendingBackgroundDownload,
  describeBackgroundDownloadFailure,
  getBackgroundDownload,
  isBackgroundDownloadActive,
  isBackgroundDownloadAvailable,
  normalizeBackgroundSnapshot,
  readPendingBackgroundDownload,
  resolveBackgroundDownload,
  savePendingBackgroundDownload,
  type PendingBackgroundDownload,
} from "./background-download";

/**
 * 原生模块与平台都可注入：Platform 用可变对象，测试里切 android/iOS 不改模块图。
 * 必须走 vi.hoisted —— vi.mock 的工厂会被提升到文件最前面，引用普通顶层变量会 TDZ 报错。
 */
const { platform, nativeCalls, storage } = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    platform: { OS: "android" as string },
    nativeCalls: { enqueue: vi.fn(), query: vi.fn(), cancel: vi.fn(), clear: vi.fn() },
    storage: {
      data,
      getItem: vi.fn(async (key: string) => data.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        data.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        data.delete(key);
      }),
    },
  };
});

vi.mock("react-native", () => ({
  Platform: platform,
  NativeModules: {
    BackgroundDownload: {
      enqueue: (...args: unknown[]) => nativeCalls.enqueue(...args),
      query: (...args: unknown[]) => nativeCalls.query(...args),
      cancel: (...args: unknown[]) => nativeCalls.cancel(...args),
      clear: (...args: unknown[]) => nativeCalls.clear(...args),
    },
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));



const snapshot = (overrides: Record<string, unknown> = {}) => ({
  status: "running",
  downloadedBytes: 50,
  totalBytes: 100,
  localUri: null,
  reason: "none",
  ...overrides,
});

beforeEach(() => {
  platform.OS = "android";
  storage.data.clear();
  vi.clearAllMocks();
});

describe("原生模块解析（平台与模块存在性）", () => {
  it("Android 且有完整模块时返回模块本身", () => {
    const module = resolveBackgroundDownload();
    expect(module).not.toBeNull();
    expect(BACKGROUND_DOWNLOAD_MODULE_NAME).toBe("BackgroundDownload");
    expect(isBackgroundDownloadAvailable()).toBe(true);
  });

  it("iOS 一律返回 null（保持原有 expo-file-system 路径）", () => {
    platform.OS = "ios";
    expect(resolveBackgroundDownload()).toBeNull();
    expect(isBackgroundDownloadAvailable()).toBe(false);
  });

  it("缺少模块 / 缺方法 / 传空对象都视为不可用（不做半残调用）", () => {
    expect(resolveBackgroundDownload({})).toBeNull();
    expect(resolveBackgroundDownload(null)).toBeNull();
    expect(resolveBackgroundDownload(undefined)).not.toBeNull(); // 不传 = 用真实 NativeModules
    expect(resolveBackgroundDownload({ BackgroundDownload: { enqueue: () => {} } })).toBeNull();
    expect(
      resolveBackgroundDownload({
        BackgroundDownload: { enqueue: () => {}, query: () => {}, cancel: () => {} },
      })
    ).toBeNull();
  });

  it("模块方法原样转发到原生（enqueue/query/cancel/clear 签名）", async () => {
    const module = getBackgroundDownload();
    expect(module).not.toBeNull();
    nativeCalls.enqueue.mockResolvedValueOnce(42);
    await expect(
      module!.enqueue("https://x/app.apk", "learn-workbench-1.58.0.apk", "苦旅 v1.58.0", "后台下载中")
    ).resolves.toBe(42);
    expect(nativeCalls.enqueue).toHaveBeenCalledWith(
      "https://x/app.apk",
      "learn-workbench-1.58.0.apk",
      "苦旅 v1.58.0",
      "后台下载中"
    );
    nativeCalls.query.mockResolvedValueOnce(snapshot({ status: "successful", localUri: "file:///x.apk" }));
    await expect(module!.query(42)).resolves.toMatchObject({ status: "successful" });
    nativeCalls.cancel.mockResolvedValueOnce(true);
    await expect(module!.cancel(42)).resolves.toBe(true);
    nativeCalls.clear.mockResolvedValueOnce(undefined);
    await expect(module!.clear(42)).resolves.toBeUndefined();
  });
});

describe("文件名与进度换算", () => {
  it("文件名与 apkUriFor 的清洗规则一致（非法字符清空、去掉路径穿越）", () => {
    expect(backgroundDownloadFileName("1.58.0")).toBe("learn-workbench-1.58.0.apk");
    expect(backgroundDownloadFileName("1.58.0-beta/../x")).toBe("learn-workbench-1.58.0-beta..x.apk");
    expect(backgroundDownloadFileName("")).toBe("learn-workbench-update.apk");
  });

  it("进度：按字节换算 ratio，总大小未知时为 0（UI 显示「计算中」）", () => {
    expect(backgroundDownloadProgress(null)).toEqual({ bytesWritten: 0, totalBytes: 0, ratio: 0 });
    expect(backgroundDownloadProgress(normalizeBackgroundSnapshot(snapshot()))).toEqual({
      bytesWritten: 50,
      totalBytes: 100,
      ratio: 0.5,
    });
    // DownloadManager 拿到 Content-Length 前 totalBytes = -1
    expect(
      backgroundDownloadProgress(normalizeBackgroundSnapshot(snapshot({ downloadedBytes: 10, totalBytes: -1 }))).ratio
    ).toBe(0);
    // 极端情况：已下载大于总大小（服务端没有 Content-Length 时的估算）也不能超过 100%
    expect(
      backgroundDownloadProgress(normalizeBackgroundSnapshot(snapshot({ downloadedBytes: 200, totalBytes: 100 }))).ratio
    ).toBe(1);
  });

  it("活跃状态判定：pending/running/paused 都算「还在跑」（paused 是系统断网自动暂停）", () => {
    expect(isBackgroundDownloadActive("pending")).toBe(true);
    expect(isBackgroundDownloadActive("running")).toBe(true);
    expect(isBackgroundDownloadActive("paused")).toBe(true);
    expect(isBackgroundDownloadActive("successful")).toBe(false);
    expect(isBackgroundDownloadActive("failed")).toBe(false);
    expect(isBackgroundDownloadActive("unknown")).toBe(false);
  });
});

describe("原生快照容错解析", () => {
  it("非对象/数组一律当「任务不存在」（null）", () => {
    expect(normalizeBackgroundSnapshot(null)).toBeNull();
    expect(normalizeBackgroundSnapshot(undefined)).toBeNull();
    expect(normalizeBackgroundSnapshot([])).toBeNull();
    expect(normalizeBackgroundSnapshot("running")).toBeNull();
  });

  it("缺字段用安全默认值，字符串数字也能转", () => {
    expect(normalizeBackgroundSnapshot({})).toEqual({
      status: "unknown",
      downloadedBytes: 0,
      totalBytes: 0,
      localUri: null,
      reason: null,
    });
    expect(normalizeBackgroundSnapshot({ status: "running", downloadedBytes: "12", totalBytes: "34" })).toMatchObject({
      downloadedBytes: 12,
      totalBytes: 34,
    });
    expect(normalizeBackgroundSnapshot({ status: "weird" })?.status).toBe("unknown");
    expect(normalizeBackgroundSnapshot({ status: "successful", localUri: "" })?.localUri).toBeNull();
    expect(normalizeBackgroundSnapshot({ status: "successful", localUri: "file:///a.apk" })?.localUri).toBe(
      "file:///a.apk"
    );
  });
});

describe("失败原因 → 用户文案（与 Kotlin reasonName 同表）", () => {
  it("网断 / 空间 / 地址失效 / 写文件 / 系统中断分别给可执行文案", () => {
    expect(describeBackgroundDownloadFailure(null)).toContain("任务已丢失");
    expect(describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "network" })))).toContain("网络中断");
    expect(
      describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "network_not_available" })))
    ).toContain("网络中断");
    expect(
      describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "insufficient_space" })))
    ).toContain("存储空间不足");
    expect(
      describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "http_404" })))
    ).toContain("地址失效");
    expect(
      describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "unhandled_http_code" })))
    ).toContain("地址失效");
    expect(
      describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "file_error" })))
    ).toContain("本地文件写入失败");
    expect(
      describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "cannot_resume" })))
    ).toContain("系统中断");
    expect(
      describeBackgroundDownloadFailure(normalizeBackgroundSnapshot(snapshot({ status: "failed", reason: "unknown_42" })))
    ).toBe("下载失败，请重新下载");
  });
});

describe("认领记录（App 重启后继续下载）", () => {
  const record: PendingBackgroundDownload = {
    id: 42,
    versionName: "1.58.0",
    versionCode: 95,
    apkUrl: "https://x/app.apk",
    sizeBytes: 60_000_000,
    sha256: "a".repeat(64),
    releaseNotes: ["修复熄屏断下载"],
    startedAt: "2026-11-01T14:00:00.000Z",
  };

  it("保存后可原样读回（含 sha256/size，重启后仍能校验）", async () => {
    await expect(savePendingBackgroundDownload(record)).resolves.toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(PENDING_BACKGROUND_DOWNLOAD_KEY, JSON.stringify(record));
    await expect(readPendingBackgroundDownload()).resolves.toEqual(record);
  });

  it("没有记录 / 非法 JSON / 缺关键字段时返回 null（不抛错）", async () => {
    await expect(readPendingBackgroundDownload()).resolves.toBeNull();
    storage.data.set(PENDING_BACKGROUND_DOWNLOAD_KEY, "{not json");
    await expect(readPendingBackgroundDownload()).resolves.toBeNull();
    storage.data.set(PENDING_BACKGROUND_DOWNLOAD_KEY, JSON.stringify({ id: 0, versionName: "1.0" }));
    await expect(readPendingBackgroundDownload()).resolves.toBeNull();
    storage.data.set(PENDING_BACKGROUND_DOWNLOAD_KEY, JSON.stringify({ id: 7 }));
    await expect(readPendingBackgroundDownload()).resolves.toBeNull();
  });

  it("旧记录字段做归一（数字字符串、releaseNotes 过滤、缺 startedAt 用纪元时间）", async () => {
    storage.data.set(
      PENDING_BACKGROUND_DOWNLOAD_KEY,
      JSON.stringify({ id: "9", versionName: "1.57.0", versionCode: "93", apkUrl: "https://x/a.apk", sizeBytes: "123", releaseNotes: ["a", 2, "b"] })
    );
    const parsed = await readPendingBackgroundDownload();
    expect(parsed).toMatchObject({ id: 9, versionCode: 93, sizeBytes: 123, releaseNotes: ["a", "b"] });
    expect(parsed?.startedAt).toBe(new Date(0).toISOString());
  });

  it("clear 会删掉记录", async () => {
    await savePendingBackgroundDownload(record);
    await clearPendingBackgroundDownload();
    expect(storage.removeItem).toHaveBeenCalledWith(PENDING_BACKGROUND_DOWNLOAD_KEY);
    await expect(readPendingBackgroundDownload()).resolves.toBeNull();
  });
});