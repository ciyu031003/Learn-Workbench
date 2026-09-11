export const APP_VERSION_NAME = "1.2.0";
export const APP_VERSION_CODE = 8;
export const APP_ICP_NUMBER = "赣ICP备2024031528号-3A";
export const PRIVACY_POLICY_URL = "https://learn.yuanabd.cn/privacy.html";
export const ICP_VERIFY_URL = "https://beian.miit.gov.cn/";
export const OTA_MANIFEST_BASE_URL = "https://learn.yuanabd.cn";

export interface OtaManifest {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  releaseNotes?: string[];
  publishedAt?: string;
}

export interface OtaCheckResult {
  hasUpdate: boolean;
  currentVersionName: string;
  latestVersionName: string;
  latestVersionCode: number;
  apkUrl?: string;
  releaseNotes?: string[];
}

function stripVersionPrefix(value: string): string {
  return value.replace(/^v/i, "").trim();
}

export function isNewer(latestVersionCode: number, currentVersionCode = APP_VERSION_CODE): boolean {
  return Number.isFinite(latestVersionCode) && latestVersionCode > currentVersionCode;
}

export async function fetchOtaManifest(baseUrl = OTA_MANIFEST_BASE_URL): Promise<OtaManifest> {
  const normalized = baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${normalized}/mobile-update.json`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`更新清单请求失败（${res.status}）`);
  }
  const data: unknown = await res.json();
  if (!data || typeof data !== "object") {
    throw new Error("更新清单格式不正确");
  }
  const manifest = data as Partial<OtaManifest>;
  if (
    typeof manifest.versionName !== "string" ||
    typeof manifest.versionCode !== "number" ||
    typeof manifest.apkUrl !== "string"
  ) {
    throw new Error("更新清单缺少必填字段");
  }
  return {
    versionName: stripVersionPrefix(manifest.versionName),
    versionCode: manifest.versionCode,
    apkUrl: manifest.apkUrl,
    releaseNotes: Array.isArray(manifest.releaseNotes)
      ? (manifest.releaseNotes as string[]).filter((n) => typeof n === "string")
      : [],
    publishedAt: typeof manifest.publishedAt === "string" ? manifest.publishedAt : undefined,
  };
}

export async function checkForUpdate(baseUrl?: string): Promise<OtaCheckResult> {
  const manifest = await fetchOtaManifest(baseUrl);
  const hasUpdate = isNewer(manifest.versionCode);
  return {
    hasUpdate,
    currentVersionName: APP_VERSION_NAME,
    latestVersionName: manifest.versionName,
    latestVersionCode: manifest.versionCode,
    apkUrl: hasUpdate ? manifest.apkUrl : undefined,
    releaseNotes: hasUpdate ? manifest.releaseNotes : undefined,
  };
}
