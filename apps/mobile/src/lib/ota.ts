import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { sha256Hex } from "./sha256";
import { getOtaPublicKeysBase64Url } from "./ota-public-key";

export const APP_VERSION_NAME = "1.49.1";
export const APP_VERSION_CODE = 83;
export const APP_ICP_NUMBER = "赣ICP备2024031528号-3A";
export const PRIVACY_POLICY_URL = "https://learn.yuanabd.cn/privacy.html";
export const ICP_VERIFY_URL = "https://beian.miit.gov.cn/";
/**
 * 公安联网备案号（公安部，与工信部 ICP 是两套号）。
 * 2026-09-18 提交「新增APP」、**2026-09-29 审核通过**（beian.mps.gov.cn，包名 com.yuanabd.learnworkbench）。
 * 2026-10-07 v1.34.1 起在「我的 → 关于」与门户 footer/privacy 展示该号码。
 * ⚠️ 已知存疑点（二轮评审标记，待人工核对）：号码省份为「粤」，而 ICP 是「赣」——
 * 公安备案省份跟随**主体所在地**，与域名 ICP 可以不同省；但若与审核通知里的原文不符，请直接改这里的值
 * （App 端改完需随下一版 APK 生效；门户 5 个页面是独立仓库 F:CodeFilesYuanAbd-Web，需同步改）。
 */
export const APP_MPS_NUMBER = "粤公网安备44010602017246号";
/** 公安备案查询链接前缀（拼上号码里的纯数字部分） */
export const MPS_VERIFY_URL = "https://beian.mps.gov.cn/#/query/webSearch?code=";
export const OTA_MANIFEST_BASE_URL = "https://learn.yuanabd.cn";
/** 手动下载页（OTA 不通时的兜底路径，永远可用） */
export const DOWNLOAD_PAGE_URL = "https://learn.yuanabd.cn/download.html";

/* ============================================================================
 * S6-7 OTA 清单加固：Ed25519 验签 + sha256 必填 + 灰度 + 最低支持版本
 * ==========================================================================*/

/**
 * Ed25519 同步验签需要显式注入 sha512（@noble/ed25519 v2 不内置哈希实现；
 * Hermes 没有 node:crypto，所以用 @noble/hashes 的纯 JS sha512）。
 */
ed.etc.sha512Sync = (...messages: Uint8Array[]) => sha512(ed.etc.concatBytes(...messages));

/**
 * 参与签名的清单字段（**顺序即 canonical JSON 的键序**，客户端/发布脚本必须完全一致）。
 * signature 自身不参与签名。新增字段必须：① 加到这里；② 两端同步；③ 重新签发清单。
 */
export const SIGNED_OTA_MANIFEST_FIELDS = [
  "versionName",
  "versionCode",
  "apkUrl",
  "sizeBytes",
  "sha256",
  "releaseNotes",
  "publishedAt",
  "rolloutPercent",
  "minSupportedVersionCode",
  "abi",
] as const;

/** 灰度分桶盐（改盐 = 重新洗牌所有用户的分桶，非必要不要改） */
export const OTA_ROLLOUT_SALT = "lwb-ota-rollout-v1";

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** UTF-8 编码（Hermes 不保证有 TextEncoder；清单说明含中文，必须自己编码） */
export function utf8Encode(input: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(out);
}

/** base64url 解码（无 padding；非法字符返回 null） */
export function base64UrlToBytes(input: string): Uint8Array | null {
  const clean = String(input ?? "").replace(/=+$/, "");
  if (!/^[A-Za-z0-9_-]*$/.test(clean)) return null;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const value = BASE64URL_ALPHABET.indexOf(ch);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/**
 * 清单的 canonical JSON（签名对象）：固定字段顺序的紧凑 JSON，排除 signature。
 * 与 scripts/lib/ota-manifest.mjs#canonicalOtaManifestJson 必须逐字节一致（两端都有 fixture 测试）。
 */
export function canonicalOtaManifestJson(manifest: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {};
  for (const field of SIGNED_OTA_MANIFEST_FIELDS) {
    if (manifest[field] !== undefined) ordered[field] = manifest[field];
  }
  return JSON.stringify(ordered);
}

/**
 * 验签：用内置公钥（+ 环境变量/历史过渡公钥）校验清单 signature。
 * 任一公钥通过即返回 true；无 signature/格式非法/验签失败都返回 false（fail closed）。
 */
export function verifyOtaManifestSignature(
  manifest: Record<string, unknown>,
  publicKeysBase64Url: string[] = getOtaPublicKeysBase64Url()
): boolean {
  const signature = manifest.signature;
  if (typeof signature !== "string" || !signature) return false;
  const signatureBytes = base64UrlToBytes(signature);
  if (!signatureBytes || signatureBytes.length !== 64) return false;
  const message = utf8Encode(canonicalOtaManifestJson(manifest));
  for (const key of publicKeysBase64Url) {
    const publicKey = base64UrlToBytes(key);
    if (!publicKey || publicKey.length !== 32) continue;
    try {
      if (ed.verify(signatureBytes, message, publicKey)) return true;
    } catch {
      // 非法公钥/签名：继续试下一把
    }
  }
  return false;
}

/** 设备灰度分桶（稳定、0-99）：同一 deviceId 永远落同一桶 */
export function rolloutBucket(deviceId: string): number {
  const digest = sha256Hex(utf8Encode(deviceId + "|" + OTA_ROLLOUT_SALT));
  return parseInt(digest.slice(0, 8), 16) % 100;
}

/**
 * 是否命中灰度：rolloutPercent=100 全量；0 关闭；非法值按全量（向后兼容旧清单）。
 * 没有 deviceId 时无法分桶 → 灰度版本不提示（fail closed）。
 */
export function isRolloutEligible(deviceId: string | null | undefined, rolloutPercent: number): boolean {
  if (!Number.isFinite(rolloutPercent)) return true;
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  if (!deviceId) return false;
  return rolloutBucket(deviceId) < rolloutPercent;
}

export interface OtaManifest {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  releaseNotes?: string[];
  publishedAt?: string;
  /** 安装包字节数（应用内升级完整性校验用；v1.10.0 起门户清单会带上） */
  sizeBytes?: number;
  /** 安装包 sha256（小写十六进制）—— S6-7 起为**必需字段** */
  sha256: string;
  /** S6-7：Ed25519 签名（64 字节 base64url），必需 */
  signature: string;
  /** S6-7：灰度比例 0-100（默认 100 = 全量） */
  rolloutPercent: number;
  /** S6-7：低于此 versionCode 的客户端强制升级（忽略「忽略此版本」与灰度） */
  minSupportedVersionCode: number;
  /** 分 ABI 清单标记（应用内升级仍只认通用单包） */
  abi?: string;
}

export interface OtaCheckResult {
  hasUpdate: boolean;
  currentVersionName: string;
  latestVersionName: string;
  latestVersionCode: number;
  apkUrl?: string;
  releaseNotes?: string[];
  sizeBytes?: number;
  sha256?: string;
  /** 命中了用户点过的「忽略此版本」 */
  ignored?: boolean;
  /** S6-7：当前版本低于 minSupportedVersionCode，必须升级（忽略灰度与「忽略此版本」） */
  mandatory?: boolean;
  /** S6-7：本次清单的灰度比例 */
  rolloutPercent?: number;
}

function stripVersionPrefix(value: string): string {
  return value.replace(/^v/i, "").trim();
}

export function isNewer(latestVersionCode: number, currentVersionCode = APP_VERSION_CODE): boolean {
  return Number.isFinite(latestVersionCode) && latestVersionCode > currentVersionCode;
}

function isHexSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value);
}

function clampRollout(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : 100;
}

function clampMinSupported(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function fetchOtaManifest(baseUrl = OTA_MANIFEST_BASE_URL): Promise<OtaManifest> {
  const normalized = baseUrl.replace(/\/+$/, "");
  // 必须破缓存：客户端是 RN（Android 侧走 OkHttp 磁盘缓存，10MB），
  // 它**不认** fetch 的 cache: "no-store"（那是浏览器语义），只会看响应头。
  // 2026-09-16 线上事故：清单被 Cache-Control: max-age=2592000 缓存 30 天，
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
  const raw = data as Record<string, unknown>;

  // 1) 必填字段（sha256 / signature 是 S6-7 新增的硬门槛）
  if (typeof raw.versionName !== "string" || typeof raw.versionCode !== "number" || typeof raw.apkUrl !== "string") {
    throw new Error("更新清单缺少必填字段");
  }
  if (!isHexSha256(raw.sha256)) {
    throw new Error("更新清单缺少 sha256（拒绝提示更新）");
  }
  if (typeof raw.signature !== "string" || !raw.signature) {
    throw new Error("更新清单缺少签名（拒绝提示更新）");
  }
  // 2) 验签（对原始字段做 canonical，而不是归一化后的值 —— versionName 的 v 前缀等不能改写签名对象）
  if (!verifyOtaManifestSignature(raw)) {
    throw new Error("更新清单验签失败（可能被篡改）");
  }
  // 3) 归一化输出
  return {
    versionName: stripVersionPrefix(raw.versionName),
    versionCode: raw.versionCode,
    apkUrl: raw.apkUrl,
    releaseNotes: Array.isArray(raw.releaseNotes)
      ? (raw.releaseNotes as unknown[]).filter((n): n is string => typeof n === "string")
      : [],
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : undefined,
    sizeBytes: typeof raw.sizeBytes === "number" && raw.sizeBytes > 0 ? raw.sizeBytes : undefined,
    sha256: raw.sha256.toLowerCase(),
    signature: raw.signature,
    rolloutPercent: clampRollout(raw.rolloutPercent),
    minSupportedVersionCode: clampMinSupported(raw.minSupportedVersionCode),
    abi: typeof raw.abi === "string" && raw.abi.trim() ? raw.abi.trim() : undefined,
  };
}

/* ============ 「忽略此版本」（应用内升级） ============ */
const IGNORED_VERSION_KEY = "lwb.ota.ignoredVersionCode.v1";

/** 读取已忽略的 versionCode（读不到返回 0） */
export async function readIgnoredVersionCode(): Promise<number> {
  if (process.env.NODE_ENV === "test") return 0;
  try {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    const raw = await AsyncStorage.getItem(IGNORED_VERSION_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** 记录「忽略此版本」（装上更新的版本后自然失效；强制升级版本不会被忽略） */
export async function ignoreVersionCode(versionCode: number): Promise<void> {
  try {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem(IGNORED_VERSION_KEY, String(versionCode));
  } catch {
    // 忽略
  }
}

/** 取设备稳定标识（灰度分桶用）；测试环境不依赖 store，调用方应显式传 deviceId */
async function resolveDeviceId(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "test") return "";
  try {
    const { useAppStore } = await import("@/store/app-store");
    return useAppStore.getState().deviceId ?? "";
  } catch {
    return "";
  }
}

export interface OtaCheckOptions {
  /** 灰度分桶用的设备标识（不传则从 store 读 deviceId） */
  deviceId?: string;
}

export async function checkForUpdate(baseUrl?: string, options?: OtaCheckOptions): Promise<OtaCheckResult> {
  const manifest = await fetchOtaManifest(baseUrl);
  const deviceId = await resolveDeviceId(options?.deviceId);
  const ignored = await readIgnoredVersionCode();
  const newer = isNewer(manifest.versionCode);
  // 低于最低支持版本：强制升级，忽略灰度与「忽略此版本」
  const mandatory = newer && manifest.minSupportedVersionCode > 0 && APP_VERSION_CODE < manifest.minSupportedVersionCode;
  const rolloutEligible = isRolloutEligible(deviceId, manifest.rolloutPercent);
  const eligible = newer && (mandatory || rolloutEligible);
  const ignoredHit = eligible && !mandatory && manifest.versionCode === ignored;
  const hasUpdate = eligible && !ignoredHit;
  return {
    hasUpdate,
    ignored: ignoredHit,
    mandatory,
    rolloutPercent: manifest.rolloutPercent,
    currentVersionName: APP_VERSION_NAME,
    latestVersionName: manifest.versionName,
    latestVersionCode: manifest.versionCode,
    apkUrl: hasUpdate ? manifest.apkUrl : undefined,
    releaseNotes: hasUpdate ? manifest.releaseNotes : undefined,
    sizeBytes: hasUpdate ? manifest.sizeBytes : undefined,
    sha256: hasUpdate ? manifest.sha256 : undefined,
  };
}

/* ============ 启动静默检查（结果落盘，「我的」页/弹层用来提示） ============ */
const PENDING_UPDATE_KEY = "lwb.pendingUpdate.v1";

export interface PendingUpdate {
  versionName: string;
  versionCode: number;
  apkUrl?: string;
  releaseNotes?: string[];
  sizeBytes?: number;
  sha256?: string;
  /** S6-7：强制升级标记（下个版本 UI 可据此禁用「忽略」） */
  mandatory?: boolean;
  rolloutPercent?: number;
  /** 检查时间（ISO） */
  checkedAt: string;
}

/** 启动时调用：有新版本就落盘；无更新/失败则清除旧标记。永不抛错。 */
export async function silentCheckForUpdate(baseUrl?: string, options?: OtaCheckOptions): Promise<PendingUpdate | null> {
  if (process.env.NODE_ENV === "test") return null;
  try {
    const [result, storage] = await Promise.all([checkForUpdate(baseUrl, options), import("@react-native-async-storage/async-storage")]);
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
      sizeBytes: result.sizeBytes,
      sha256: result.sha256,
      mandatory: result.mandatory,
      rolloutPercent: result.rolloutPercent,
      checkedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PENDING_UPDATE_KEY, JSON.stringify(pending));
    return pending;
  } catch {
    // 离网 / 清单不可用（含验签失败）：保持原状，不打扰用户
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
