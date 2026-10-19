/**
 * OTA 清单（`mobile-update.json`）的纯逻辑 + Ed25519 签名/验签（S6-7 加固）。
 *
 * 清单是发布链路的核心产物：应用内升级靠它判断版本、校验 APK 完整性。
 * 只校验 APK sha256 不够 —— 清单本身可被替换（CDN/中间人/误操作），所以：
 *   - 发布脚本用**离线私钥**对清单签名（node:crypto 的 Ed25519）；
 *   - 客户端用内置公钥验签（@noble/ed25519）；私钥只在发布机/CI Secret，**绝不入库**。
 *
 * 公钥格式：Ed25519 raw 32 字节的 base64url（无 padding）。
 * 签名对象：canonicalOtaManifestJson —— 固定字段顺序的紧凑 JSON，排除 signature。
 * 该函数与 apps/mobile/src/lib/ota.ts 的实现必须逐字节一致（两端 fixture 测试守住）。
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";

/** 默认下载域名（与门户 / nginx 的 /download/ 路径一致） */
export const DEFAULT_OTA_BASE = "https://learn.yuanabd.cn";

/**
 * 参与签名的字段（顺序即 canonical JSON 键序）。
 * 与 apps/mobile/src/lib/ota.ts#SIGNED_OTA_MANIFEST_FIELDS 必须完全一致。
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
];

/** Ed25519 SPKI DER 前缀（12 字节）——用于把 raw 32 字节公钥还原成 node KeyObject */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function sha256OfFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/** 一行一条说明；`#` 开头是注释；空行忽略 */
export function parseReleaseNotes(raw) {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export async function readReleaseNotesFile(file) {
  return parseReleaseNotes(await readFile(file, "utf8"));
}

/**
 * APK 文件名（S3-7 ABI 拆分后按 ABI 分文件）。
 * @param {string} versionName 版本名
 * @param {string=} abi 可选：arm64-v8a / armeabi-v7a；
 *   不传 = 通用单包（learn-workbench-v1.42.0.apk），
 *   传了 = 分 ABI 包（learn-workbench-v1.42.0-arm64-v8a.apk）。
 */
export function apkFileName(versionName, abi) {
  const suffix = abi ? "-" + String(abi).trim() : "";
  return `learn-workbench-v${versionName}${suffix}.apk`;
}

export function apkUrlFor(versionName, base = DEFAULT_OTA_BASE, abi) {
  return `${String(base).replace(/\/+$/, "")}/download/${apkFileName(versionName, abi)}`;
}

/* ------------------------------------------------------------------ 签名 */

/** canonical JSON（签名对象）：固定字段顺序 + 紧凑格式，排除 signature */
export function canonicalOtaManifestJson(manifest) {
  const ordered = {};
  for (const field of SIGNED_OTA_MANIFEST_FIELDS) {
    if (manifest[field] !== undefined) ordered[field] = manifest[field];
  }
  return JSON.stringify(ordered);
}

function privateKeyObject(privateKeyPem) {
  if (typeof privateKeyPem === "string" && privateKeyPem.includes("BEGIN")) {
    return createPrivateKey(privateKeyPem);
  }
  return privateKeyPem;
}

/** 对清单签名：返回带 signature 的新对象（base64url，64 字节） */
export function signOtaManifest(manifest, privateKeyPem) {
  const payload = Buffer.from(canonicalOtaManifestJson(manifest), "utf8");
  const signature = sign(null, payload, privateKeyObject(privateKeyPem)).toString("base64url");
  return { ...manifest, signature };
}

/** 从私钥推导编入客户端的 raw 32 字节公钥（base64url）—— 轮换时用它更新 ota-public-key.ts */
export function publicKeyBase64UrlFromPrivate(privateKeyPem) {
  const privateKey = privateKeyObject(privateKeyPem);
  const spki = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  return Buffer.from(spki.subarray(spki.length - 32)).toString("base64url");
}

/** 用 raw 32 字节 base64url 公钥验签 */
export function verifyOtaManifestSignature(manifest, publicKeyBase64Url) {
  try {
    const raw = Buffer.from(String(publicKeyBase64Url ?? ""), "base64url");
    if (raw.length !== 32) return false;
    if (typeof manifest.signature !== "string" || !manifest.signature) return false;
    const signature = Buffer.from(manifest.signature, "base64url");
    if (signature.length !== 64) return false;
    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(canonicalOtaManifestJson(manifest), "utf8"), publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * 生成新密钥对（轮换/首次初始化用）：
 *   const { publicKeyBase64Url, privateKeyPem } = generateOtaKeyPair();
 *   公钥写进 apps/mobile/src/lib/ota-public-key.ts；私钥写本机 .local/ota-signing-key.pem（勿入库）或 CI Secret。
 */
export function generateOtaKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" });
  return {
    publicKeyBase64Url: Buffer.from(spki.subarray(spki.length - 32)).toString("base64url"),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }),
  };
}

/* -------------------------------------------------------------- 清单构造 */

/**
 * 构造 OTA 清单对象（**未签名**；真实发布请先 buildOtaManifest 再 signOtaManifest）。
 * `publishedAt` 可显式传入（复现/测试用），默认取当前时间。
 */
export function buildOtaManifest(input) {
  const base = input.base ?? DEFAULT_OTA_BASE;
  const abi = input.abi ? String(input.abi).trim() : "";
  const rolloutPercent = Number.isFinite(Number(input.rolloutPercent)) ? Number(input.rolloutPercent) : 100;
  const minSupportedVersionCode = Number.isFinite(Number(input.minSupportedVersionCode))
    ? Number(input.minSupportedVersionCode)
    : 0;
  const manifest = {
    versionName: String(input.versionName),
    versionCode: Number(input.versionCode),
    apkUrl: apkUrlFor(input.versionName, base, abi || undefined),
    sizeBytes: Number(input.sizeBytes),
    sha256: String(input.sha256),
    releaseNotes: Array.isArray(input.releaseNotes) ? input.releaseNotes : [],
    publishedAt: input.publishedAt ?? new Date().toISOString(),
    rolloutPercent,
    minSupportedVersionCode,
  };
  // S3-7：按 ABI 的清单额外带 abi 字段（应用内升级仍只认通用单包）。
  if (abi) manifest.abi = abi;
  return manifest;
}

export function serializeOtaManifest(manifest) {
  return JSON.stringify(manifest, null, 2) + "\n";
}

/**
 * 清单自检：门槛全部来自"这份清单能不能骗过应用内升级"。
 * @param {object} manifest
 * @param {{ apkSizeBytes?: number, apkSha256?: string, publicKeyBase64Url?: string, requireSignature?: boolean }} [opts]
 * @returns {string[]} 问题列表（空数组 = 通过）
 */
export function validateOtaManifest(manifest, opts = {}) {
  const problems = [];
  if (!/^\d+\.\d+\.\d+/.test(String(manifest.versionName ?? ""))) problems.push(`versionName 非法：${manifest.versionName}`);
  if (!Number.isInteger(manifest.versionCode) || manifest.versionCode <= 0) problems.push(`versionCode 非法：${manifest.versionCode}`);
  if (!/^https:\/\//.test(String(manifest.apkUrl ?? ""))) problems.push(`apkUrl 必须是 https：${manifest.apkUrl}`);
  if (!Number.isFinite(manifest.sizeBytes) || manifest.sizeBytes <= 0) problems.push(`sizeBytes 非法：${manifest.sizeBytes}`);
  if (!/^[0-9a-f]{64}$/.test(String(manifest.sha256 ?? ""))) problems.push(`sha256 非法：${manifest.sha256}`);
  if (!Number.isInteger(manifest.rolloutPercent) || manifest.rolloutPercent < 0 || manifest.rolloutPercent > 100) {
    problems.push(`rolloutPercent 非法（0-100）：${manifest.rolloutPercent}`);
  }
  if (!Number.isInteger(manifest.minSupportedVersionCode) || manifest.minSupportedVersionCode < 0) {
    problems.push(`minSupportedVersionCode 非法（>=0 的整数）：${manifest.minSupportedVersionCode}`);
  }
  if (Array.isArray(manifest.releaseNotes) && manifest.releaseNotes.length === 0) {
    problems.push("releaseNotes 为空（升级弹窗会没有说明）");
  }

  if (opts.requireSignature && (typeof manifest.signature !== "string" || !manifest.signature)) {
    problems.push("缺少 signature（清单未签名，客户端会拒绝提示更新）");
  } else if (manifest.signature) {
    const signatureBytes = Buffer.from(String(manifest.signature), "base64url");
    if (signatureBytes.length !== 64) problems.push("signature 不是 64 字节的 base64url");
    if (opts.publicKeyBase64Url && !verifyOtaManifestSignature(manifest, opts.publicKeyBase64Url)) {
      problems.push("signature 验签失败（私钥与内置公钥不匹配或清单被改动）");
    }
  }

  if (Number.isFinite(opts.apkSizeBytes) && opts.apkSizeBytes !== manifest.sizeBytes) {
    problems.push(`sizeBytes 与 APK 不一致：清单 ${manifest.sizeBytes} / 实际 ${opts.apkSizeBytes}`);
  }
  if (opts.apkSha256 && opts.apkSha256 !== manifest.sha256) {
    problems.push(`sha256 与 APK 不一致：清单 ${manifest.sha256} / 实际 ${opts.apkSha256}`);
  }
  return problems;
}
