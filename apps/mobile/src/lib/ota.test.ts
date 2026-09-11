import { describe, expect, it, vi } from "vitest";
import { APP_VERSION_CODE, checkForUpdate, fetchOtaManifest, isNewer } from "./ota";

const manifest = {
  versionName: "v1.2.0",
  versionCode: 8,
  apkUrl: "https://learn.yuanabd.cn/download/learn-workbench-v1.2.0.apk",
  releaseNotes: ["新增市场分析工作台", "展示 App 备案信息"],
  publishedAt: "2026-09-11T00:00:00+08:00",
};

function mockOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => data,
    }),
  );
}

describe("ota", () => {
  it("normalizes the manifest and validates required fields", async () => {
    mockOk(manifest);
    const parsed = await fetchOtaManifest("https://learn.yuanabd.cn/");
    expect(parsed.versionName).toBe("1.2.0");
    expect(parsed.versionCode).toBe(8);
    expect(parsed.releaseNotes).toHaveLength(2);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://learn.yuanabd.cn/mobile-update.json",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("rejects manifests with missing required fields", async () => {
    mockOk({ versionName: "1.2.0" });
    await expect(fetchOtaManifest("https://learn.yuanabd.cn")).rejects.toThrow("缺少必填字段");
  });

  it("treats a same-version or older manifest as no update", async () => {
    expect(isNewer(APP_VERSION_CODE)).toBe(false);
    expect(isNewer(APP_VERSION_CODE - 1)).toBe(false);
    expect(isNewer(APP_VERSION_CODE + 1)).toBe(true);
  });

  it("returns apkUrl only when an update is available", async () => {
    mockOk({ ...manifest, versionCode: APP_VERSION_CODE + 1, versionName: "1.3.0" });
    const result = await checkForUpdate("https://learn.yuanabd.cn");
    expect(result.hasUpdate).toBe(true);
    expect(result.apkUrl).toBe(manifest.apkUrl);
    expect(result.latestVersionName).toBe("1.3.0");

    mockOk(manifest);
    const current = await checkForUpdate("https://learn.yuanabd.cn");
    expect(current.hasUpdate).toBe(false);
    expect(current.apkUrl).toBeUndefined();
  });
});
