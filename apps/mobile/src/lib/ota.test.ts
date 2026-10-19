import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import {
  APP_VERSION_CODE,
  base64UrlToBytes,
  canonicalOtaManifestJson,
  checkForUpdate,
  fetchOtaManifest,
  isNewer,
  isRolloutEligible,
  rolloutBucket,
  utf8Encode,
  verifyOtaManifestSignature,
} from "./ota";

const SHA = "a".repeat(64);
const APK_URL = "https://learn.yuanabd.cn/download/learn-workbench-v1.2.0.apk";

/** 测试用 Ed25519 密钥对（node:crypto 生成，模拟发布脚本签名） */
const { publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("ed25519");
const TEST_PUBLIC_KEY_BASE64URL = Buffer.from(
  TEST_PUBLIC_KEY.export({ type: "spki", format: "der" }).subarray(-32)
).toString("base64url");

function baseManifest(overrides: Record<string, unknown> = {}) {
  return {
    versionName: "1.2.0",
    versionCode: 8,
    apkUrl: APK_URL,
    sizeBytes: 700,
    sha256: SHA,
    releaseNotes: ["新增市场分析工作台", "展示 App 备案信息"],
    publishedAt: "2026-09-11T00:00:00.000Z",
    rolloutPercent: 100,
    minSupportedVersionCode: 0,
    ...overrides,
  };
}

/** 与发布脚本同样的签名方式：canonical JSON → node:crypto Ed25519 */
function signManifest(manifest: Record<string, unknown>) {
  const payload = Buffer.from(canonicalOtaManifestJson(manifest), "utf8");
  return {
    ...manifest,
    signature: nodeSign(null, payload, TEST_PRIVATE_KEY).toString("base64url"),
  };
}

function mockOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => data,
    })
  );
}

beforeEach(() => {
  // 客户端公钥通过环境变量注入（生产用 ota-public-key.ts 内置值）
  process.env.EXPO_PUBLIC_OTA_PUBLIC_KEY = TEST_PUBLIC_KEY_BASE64URL;
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_OTA_PUBLIC_KEY;
  vi.unstubAllGlobals();
});

describe("canonical 签名对象（跨端 fixture）", () => {
  it("固定字段顺序的紧凑 JSON（与 scripts/lib/ota-manifest.test.mjs 用同一份期望值）", () => {
    expect(canonicalOtaManifestJson(baseManifest())).toBe(
      '{"versionName":"1.2.0","versionCode":8,"apkUrl":"' +
        APK_URL +
        '","sizeBytes":700,"sha256":"' +
        SHA +
        '","releaseNotes":["新增市场分析工作台","展示 App 备案信息"],"publishedAt":"2026-09-11T00:00:00.000Z","rolloutPercent":100,"minSupportedVersionCode":0}'
    );
  });

  it("signature/未知字段不参与签名；abi 存在时参与", () => {
    const withExtra = baseManifest({ signature: "ignored", unknown: 1, abi: "arm64-v8a" });
    expect(canonicalOtaManifestJson(withExtra)).toContain('"abi":"arm64-v8a"');
    expect(canonicalOtaManifestJson(withExtra)).not.toContain("signature");
    expect(canonicalOtaManifestJson(withExtra)).not.toContain("unknown");
  });

  it("utf8Encode / base64UrlToBytes 与 Buffer 一致（含中文/emoji）", () => {
    for (const sample of ["abc", "苦旅", "a😀b"]) {
      expect(Array.from(utf8Encode(sample))).toEqual(Array.from(Buffer.from(sample, "utf8")));
    }
    const bytes = Buffer.from("hello 苦旅", "utf8");
    expect(Array.from(base64UrlToBytes(bytes.toString("base64url")) ?? [])).toEqual(Array.from(bytes));
    expect(base64UrlToBytes("!!!")).toBeNull();
  });
});

describe("ota 验签", () => {
  it("normalizes the manifest and validates required fields", async () => {
    mockOk(signManifest(baseManifest()));
    const parsed = await fetchOtaManifest("https://learn.yuanabd.cn/");
    expect(parsed.versionName).toBe("1.2.0");
    expect(parsed.versionCode).toBe(8);
    expect(parsed.releaseNotes).toHaveLength(2);
    expect(parsed.rolloutPercent).toBe(100);
    expect(parsed.minSupportedVersionCode).toBe(0);
    const [calledUrl, calledInit] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    // 2026-09-16 事故回归：清单 URL 必须带破缓存参数，且带 no-cache 头。
    expect(String(calledUrl)).toMatch(/^https:\/\/learn\.yuanabd\.cn\/mobile-update\.json\?t=\d+$/);
    expect(calledInit).toMatchObject({
      cache: "no-store",
      headers: expect.objectContaining({ "Cache-Control": "no-cache" }),
    });
  });

  it("两次请求的 URL 不同（否则会被客户端缓存复用）", async () => {
    mockOk(signManifest(baseManifest()));
    await fetchOtaManifest("https://learn.yuanabd.cn");
    await new Promise((r) => setTimeout(r, 5));
    await fetchOtaManifest("https://learn.yuanabd.cn");
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls).toHaveLength(2);
    expect(calls.every((u) => /[?&]t=\d+/.test(u))).toBe(true);
  });

  it("缺 signature / signature 非法 / 被篡改都拒绝（fail closed）", async () => {
    const signed = signManifest(baseManifest());
    mockOk({ ...signed, signature: undefined });
    await expect(fetchOtaManifest("https://learn.yuanabd.cn")).rejects.toThrow("缺少签名");

    mockOk({ ...signed, signature: "not-base64url!!!" });
    await expect(fetchOtaManifest("https://learn.yuanabd.cn")).rejects.toThrow("验签失败");

    mockOk({ ...signed, versionCode: 9 }); // 签名后改字段
    await expect(fetchOtaManifest("https://learn.yuanabd.cn")).rejects.toThrow("验签失败");

    mockOk({ ...signed, apkUrl: "https://evil.example.com/x.apk" });
    await expect(fetchOtaManifest("https://learn.yuanabd.cn")).rejects.toThrow("验签失败");
  });

  it("S6-7：sha256 必需（缺失/非法直接拒绝提示更新）", async () => {
    const noSha = signManifest(baseManifest({ sha256: undefined }));
    mockOk(noSha);
    await expect(fetchOtaManifest("https://learn.yuanabd.cn")).rejects.toThrow("缺少 sha256");

    const badSha = signManifest(baseManifest({ sha256: "zz" }));
    mockOk(badSha);
    await expect(fetchOtaManifest("https://learn.yuanabd.cn")).rejects.toThrow("缺少 sha256");
  });

  it("sha256 大小写归一；rollout/minSupported 非法值兜底", async () => {
    mockOk(signManifest(baseManifest({ sha256: SHA.toUpperCase(), rolloutPercent: 999, minSupportedVersionCode: -3 })));
    const parsed = await fetchOtaManifest("https://learn.yuanabd.cn");
    expect(parsed.sha256).toBe(SHA);
    expect(parsed.rolloutPercent).toBe(100);
    expect(parsed.minSupportedVersionCode).toBe(0);
  });

  it("verifyOtaManifestSignature 可直接用于诊断（正确= true / 篡改= false）", () => {
    const signed = signManifest(baseManifest());
    expect(verifyOtaManifestSignature(signed)).toBe(true);
    expect(verifyOtaManifestSignature({ ...signed, versionName: "9.9.9" })).toBe(false);
    delete process.env.EXPO_PUBLIC_OTA_PUBLIC_KEY;
    // 内置公钥不等于测试私钥 → 用测试钥签的清单不应通过
    expect(verifyOtaManifestSignature(signed)).toBe(false);
  });
});

describe("灰度与最低支持版本", () => {
  it("rolloutBucket 稳定且落在 0-99", () => {
    const bucket = rolloutBucket("device-abc");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
    expect(rolloutBucket("device-abc")).toBe(bucket);
    expect(rolloutBucket("device-xyz")).not.toBe(bucket);
  });

  it("isRolloutEligible：0 关闭 / 100 全量 / 中间按分桶", () => {
    expect(isRolloutEligible("d1", 0)).toBe(false);
    expect(isRolloutEligible(undefined, 0)).toBe(false);
    expect(isRolloutEligible("d1", 100)).toBe(true);
    expect(isRolloutEligible(undefined, 100)).toBe(true);
    expect(isRolloutEligible("d1", Number.NaN)).toBe(true);
    const bucket = rolloutBucket("d1");
    expect(isRolloutEligible("d1", bucket + 1)).toBe(true);
    if (bucket > 0) expect(isRolloutEligible("d1", bucket)).toBe(false);
    expect(isRolloutEligible(undefined, 50)).toBe(false);
  });

  it("灰度 0 = 有更新也不提示；100 = 正常提示", async () => {
    mockOk(signManifest(baseManifest({ versionCode: APP_VERSION_CODE + 1, versionName: "1.3.0" })));
    // rolloutPercent 默认 100 = 全量
    const full = await checkForUpdate("https://learn.yuanabd.cn", { deviceId: "dev-1" });
    expect(full.hasUpdate).toBe(true);

    mockOk(signManifest(baseManifest({ versionCode: APP_VERSION_CODE + 1, versionName: "1.3.0", rolloutPercent: 0 })));
    const off = await checkForUpdate("https://learn.yuanabd.cn", { deviceId: "dev-1" });
    expect(off.hasUpdate).toBe(false);
    expect(off.apkUrl).toBeUndefined();

    mockOk(signManifest(baseManifest({ versionCode: APP_VERSION_CODE + 1, versionName: "1.3.0", rolloutPercent: 100 })));
    const on = await checkForUpdate("https://learn.yuanabd.cn", { deviceId: "dev-1" });
    expect(on.hasUpdate).toBe(true);
  });

  it("minSupportedVersionCode 高于当前版本 → mandatory（忽略灰度/忽略版本）", async () => {
    mockOk(
      signManifest(
        baseManifest({
          versionCode: APP_VERSION_CODE + 1,
          versionName: "1.3.0",
          rolloutPercent: 0,
          minSupportedVersionCode: APP_VERSION_CODE + 1,
        })
      )
    );
    const result = await checkForUpdate("https://learn.yuanabd.cn", { deviceId: "dev-1" });
    expect(result.mandatory).toBe(true);
    expect(result.hasUpdate).toBe(true);
    expect(result.apkUrl).toBe(APK_URL);
  });

  it("treats a same-version or older manifest as no update", () => {
    expect(isNewer(APP_VERSION_CODE)).toBe(false);
    expect(isNewer(APP_VERSION_CODE - 1)).toBe(false);
    expect(isNewer(APP_VERSION_CODE + 1)).toBe(true);
  });

  it("有更新时把 sizeBytes/sha256 一起带出（应用内升级校验用）", async () => {
    mockOk(
      signManifest(
        baseManifest({ versionCode: APP_VERSION_CODE + 1, versionName: "1.10.0", sizeBytes: 70019264, sha256: "b".repeat(64) })
      )
    );
    const result = await checkForUpdate("https://learn.yuanabd.cn", { deviceId: "dev-1" });
    expect(result.sizeBytes).toBe(70019264);
    expect(result.sha256).toBe("b".repeat(64));
  });
});
