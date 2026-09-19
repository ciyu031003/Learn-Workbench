import { describe, it, expect, vi, beforeEach } from "vitest";

const getInfoAsync = vi.fn();
const readAsStringAsync = vi.fn();
const createDownloadResumable = vi.fn();
const makeDirectoryAsync = vi.fn();
const deleteAsync = vi.fn();
const getContentUriAsync = vi.fn();
const startActivityAsync = vi.fn();

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  getInfoAsync: (...args: unknown[]) => getInfoAsync(...args),
  readAsStringAsync: (...args: unknown[]) => readAsStringAsync(...args),
  createDownloadResumable: (...args: unknown[]) => createDownloadResumable(...args),
  makeDirectoryAsync: (...args: unknown[]) => makeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => deleteAsync(...args),
  getContentUriAsync: (...args: unknown[]) => getContentUriAsync(...args),
}));
vi.mock("expo-intent-launcher", () => ({
  startActivityAsync: (...args: unknown[]) => startActivityAsync(...args),
  ActivityAction: { MANAGE_UNKNOWN_APP_SOURCES: "android.settings.MANAGE_UNKNOWN_APP_SOURCES" },
}));

import {
  ApkDownloader,
  apkUriFor,
  installApk,
  isInstallPermissionError,
  openUnknownSourcesSettings,
  removeApk,
  verifyApk,
} from "./update-manager";
import { decodeBase64 } from "./file-hash";
import { sha256Hex } from "./sha256";

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

beforeEach(() => {
  vi.resetAllMocks();
  getInfoAsync.mockResolvedValue({ exists: true, size: 3, uri: "file:///cache/updates/app.apk", isDirectory: false });
});

describe("decodeBase64", () => {
  it("与 Node 的 base64 解码一致（含填充与非法字符）", () => {
    for (const sample of ["", "a", "ab", "abc", "hello world", "苦旅"]) {
      const encoded = Buffer.from(sample, "utf8").toString("base64");
      expect(Array.from(decodeBase64(encoded))).toEqual(Array.from(Buffer.from(sample, "utf8")));
    }
    expect(Array.from(decodeBase64("aGVs bG8="))).toEqual(Array.from(Buffer.from("hello")));
  });
});

describe("apkUriFor", () => {
  it("按版本号落在缓存目录 updates/ 下，并清掉非法字符", () => {
    expect(apkUriFor("1.10.0")).toBe("file:///cache/updates/learn-workbench-1.10.0.apk");
    expect(apkUriFor("1.10.0-beta/../x")).toBe("file:///cache/updates/learn-workbench-1.10.0-beta..x.apk");
  });
});

describe("verifyApk", () => {
  it("大小不符直接判失败（半包场景）", async () => {
    getInfoAsync.mockResolvedValue({ exists: true, size: 100 });
    const result = await verifyApk("file:///a.apk", { sizeBytes: 200 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("大小不符");
  });

  it("文件不存在判失败", async () => {
    getInfoAsync.mockResolvedValue({ exists: false });
    const result = await verifyApk("file:///a.apk", { sizeBytes: 200 });
    expect(result.ok).toBe(false);
    expect(result.size).toBe(0);
  });

  it("清单没给 sha256 时只校验大小", async () => {
    const result = await verifyApk("file:///a.apk", { sizeBytes: 3 });
    expect(result.ok).toBe(true);
    expect(result.sha256Checked).toBe(false);
  });

  it("sha256 一致则通过，不一致则失败", async () => {
    readAsStringAsync.mockResolvedValue(b64("abc"));
    const good = sha256Hex("abc");
    const okResult = await verifyApk("file:///a.apk", { sizeBytes: 3, sha256: good });
    expect(okResult.ok).toBe(true);
    expect(okResult.sha256Checked).toBe(true);
    const badResult = await verifyApk("file:///a.apk", { sizeBytes: 3, sha256: "0".repeat(64) });
    expect(badResult.ok).toBe(false);
    expect(badResult.reason).toContain("sha256");
  });

  it("读文件失败时不阻塞安装（退化为仅大小校验）", async () => {
    readAsStringAsync.mockRejectedValue(new Error("read failed"));
    const result = await verifyApk("file:///a.apk", { sizeBytes: 3, sha256: "a".repeat(64) });
    expect(result.ok).toBe(true);
    expect(result.sha256Checked).toBe(false);
    expect(result.reason).toContain("sha256 校验不可用");
  });
});

describe("ApkDownloader", () => {
  it("下载完成后返回 true，并把进度换算成 ratio", async () => {
    let progressHandler: ((data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void) | null = null;
    const downloadAsync = vi.fn().mockImplementation(async () => {
      progressHandler?.({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
      return { uri: "file:///cache/updates/app.apk" };
    });
    createDownloadResumable.mockImplementation((_url, _dest, _options, handler) => {
      progressHandler = handler;
      return { downloadAsync, pauseAsync: vi.fn(), resumeAsync: vi.fn() };
    });
    const seen: number[] = [];
    const downloader = new ApkDownloader("https://x/app.apk", "file:///cache/updates/app.apk", (p) => seen.push(p.ratio));
    const done = await downloader.start();
    expect(done).toBe(true);
    expect(seen).toEqual([0.5]);
    expect(downloader.lastProgress.bytesWritten).toBe(50);
  });

  it("被暂停时返回 false，resume 后返回 true", async () => {
    const pauseAsync = vi.fn().mockResolvedValue(undefined);
    createDownloadResumable.mockReturnValue({
      downloadAsync: vi.fn().mockResolvedValue(undefined),
      pauseAsync,
      resumeAsync: vi.fn().mockResolvedValue({ uri: "file:///cache/updates/app.apk" }),
    });
    const downloader = new ApkDownloader("https://x/app.apk", "file:///cache/updates/app.apk");
    expect(await downloader.start()).toBe(false);
    await downloader.pause();
    expect(pauseAsync).toHaveBeenCalled();
    expect(await downloader.resume()).toBe(true);
  });

  it("cancel 会暂停并删掉半包", async () => {
    createDownloadResumable.mockReturnValue({
      downloadAsync: vi.fn(),
      pauseAsync: vi.fn().mockResolvedValue(undefined),
      resumeAsync: vi.fn(),
    });
    const downloader = new ApkDownloader("https://x/app.apk", "file:///cache/updates/app.apk");
    await downloader.cancel();
    expect(deleteAsync).toHaveBeenCalledWith("file:///cache/updates/app.apk", { idempotent: true });
  });
});

describe("安装与授权", () => {
  it("installApk 把 content 交给系统安装器", async () => {
    getContentUriAsync.mockResolvedValue("content://media/app.apk");
    await installApk("file:///cache/updates/app.apk");
    expect(getContentUriAsync).toHaveBeenCalledWith("file:///cache/updates/app.apk");
    expect(startActivityAsync).toHaveBeenCalledWith("android.intent.action.VIEW", {
      data: "content://media/app.apk",
      type: "application/vnd.android.package-archive",
      flags: 1,
    });
  });

  it("引导授权打开安装未知应用设置页", async () => {
    await openUnknownSourcesSettings();
    expect(startActivityAsync).toHaveBeenCalledWith("android.settings.MANAGE_UNKNOWN_APP_SOURCES", {
      data: "package:com.yuanabd.learnworkbench",
    });
  });

  it("识别安装未知应用类报错", () => {
    expect(isInstallPermissionError(new Error("Permission Denial: not allowed to install"))).toBe(true);
    expect(isInstallPermissionError(new Error("network unreachable"))).toBe(false);
  });

  it("removeApk 幂等删除", async () => {
    await removeApk("file:///cache/updates/app.apk");
    expect(deleteAsync).toHaveBeenCalledWith("file:///cache/updates/app.apk", { idempotent: true });
  });
});

