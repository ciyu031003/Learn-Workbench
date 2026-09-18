export const APP_VERSION_NAME = "1.8.0";
export const APP_VERSION_CODE = 20;
export const APP_ICP_NUMBER = "赣ICP备2024031528号-3A";
export const PRIVACY_POLICY_URL = "https://learn.yuanabd.cn/privacy.html";
export const ICP_VERIFY_URL = "https://beian.miit.gov.cn/";
export const OTA_MANIFEST_BASE_URL = "https://learn.yuanabd.cn";
/** 手动下载页（OTA 不通时的兜底路径，永远可用） */
export const DOWNLOAD_PAGE_URL = "https://learn.yuanabd.cn/download.html";

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
  // 必须破缓存：客户端是 RN（Android 侧走 OkHttp 磁盘缓存，10MB），
  // 它**不认** fetch 的 `cache: "no-store"`（那是浏览器语义），只会看响应头。
  // 2026-09-16 线上事故：清单被 `Cache-Control: max-age=2592000` 缓存 30 天，
  // 已安装用户永远读到旧清单、检查更新始终「已是最新」→ 无法升级。
  // 现在三重保险：① 随机查询串（缓存键不同）② no-cache 头 ③ cache:"no-store"。
  const url = `${normalized}/mobile-update.json?t=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
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

/* ============ 启动静默检查（APP v2 阶段 D / 决策 D8 收尾） ============
 * 目标：不打断启动、不弹窗，只在「我的」页把「检查更新」那一行标成「发现新版本」，
 * 并把 release notes 带过去展示。结果写 AsyncStorage（失败/离网时静默忽略）。
 */
const PENDING_UPDATE_KEY = "lwb.pendingUpdate.v1";

export interface PendingUpdate {
  versionName: string;
  versionCode: number;
  apkUrl?: string;
  releaseNotes?: string[];
  /** 检查时间（ISO） */
  checkedAt: string;
}

/** 启动时调用：有新版本就落盘；无更新/失败则清除旧标记。永不抛错。 */
export async function silentCheckForUpdate(baseUrl?: string): Promise<PendingUpdate | null> {
  if (process.env.NODE_ENV === "test") return null;
  try {
    const [result, storage] = await Promise.all([checkForUpdate(baseUrl), import("@react-native-async-storage/async-storage")]);
    const AsyncStorage = storage.default;
    if (!result.hasUpdate) {
      await AsyncStorage.removeItem(PENDING_UPDATE_KEY);
      return null;
    }
    const pending: PendingUpdate = {
      versionName: result.latestVersionName,
      versionCode: result.latestVersionCode,
      apkUrl: result.apkUrl,
      releaseNotes: result.releaseNotes,
      checkedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PENDING_UPDATE_KEY, JSON.stringify(pending));
    return pending;
  } catch {
    // 离网 / 清单不可用：保持原状，不打扰用户
    return null;
  }
}

/** 读取启动检查结果（「我的」页用来初始化「发现新版本」状态） */
export async function readPendingUpdate(): Promise<PendingUpdate | null> {
  if (process.env.NODE_ENV === "test") return null;
  try {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    const raw = await AsyncStorage.getItem(PENDING_UPDATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingUpdate;
    // 已经装上去了就不再提示
    if (!isNewer(parsed.versionCode)) {
      await AsyncStorage.removeItem(PENDING_UPDATE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 用户点过「稍后」→ 清除标记 */
export async function clearPendingUpdate(): Promise<void> {
  try {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    await AsyncStorage.removeItem(PENDING_UPDATE_KEY);
  } catch {
    // 忽略
  }
}
