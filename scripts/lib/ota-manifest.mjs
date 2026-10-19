/**
 * OTA 清单（`mobile-update.json`）的纯逻辑（组一 · 阶段 4 抽出）。
 *
 * 抽出的原因：这份清单是**发布链路的核心产物**（应用内升级靠它判断版本与校验完整性），
 * 但此前只存在于 `build-ota-manifest.mjs` 的顶层代码里，无法被发布脚本复用、也无法单测。
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";

/** 默认下载域名（与门户 / nginx 的 /download/ 路径一致） */
export const DEFAULT_OTA_BASE = "https://learn.yuanabd.cn";

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

/**
 * 构造 OTA 清单对象。
 * `publishedAt` 可显式传入（复现/测试用），默认取当前时间。
 */
export function buildOtaManifest(input) {
  const base = input.base ?? DEFAULT_OTA_BASE;
  const abi = input.abi ? String(input.abi).trim() : "";
  const manifest = {
    versionName: String(input.versionName),
    versionCode: Number(input.versionCode),
    apkUrl: apkUrlFor(input.versionName, base, abi || undefined),
    sizeBytes: Number(input.sizeBytes),
    sha256: String(input.sha256),
    releaseNotes: Array.isArray(input.releaseNotes) ? input.releaseNotes : [],
    publishedAt: input.publishedAt ?? new Date().toISOString(),
  };
  // S3-7：按 ABI 的清单额外带 abi 字段。
  // 当前客户端（apps/mobile/src/lib/ota.ts 的 fetchOtaManifest）只读 versionName/versionCode/apkUrl，
  // 多出的字段会被忽略 —— 所以按 ABI 清单只能给「会自选 ABI 的下载页/未来客户端」用，
  // 应用内升级（单 apkUrl）仍必须发布通用单包（见 scripts/build-android-release.ps1 -UniversalApk）。
  if (abi) manifest.abi = abi;
  return manifest;
}

export function serializeOtaManifest(manifest) {
  return JSON.stringify(manifest, null, 2) + "\n";
}

/**
 * 清单自检：门槛全部来自"这份清单能不能骗过应用内升级"。
 * 返回问题列表（空数组 = 通过）。
 */
export function validateOtaManifest(manifest, { apkSizeBytes, apkSha256 } = {}) {
  const problems = [];
  if (!/^\d+\.\d+\.\d+/.test(String(manifest.versionName ?? ""))) problems.push(`versionName 非法：${manifest.versionName}`);
  if (!Number.isInteger(manifest.versionCode) || manifest.versionCode <= 0) problems.push(`versionCode 非法：${manifest.versionCode}`);
  if (!/^https:\/\//.test(String(manifest.apkUrl ?? ""))) problems.push(`apkUrl 必须是 https：${manifest.apkUrl}`);
  if (!Number.isFinite(manifest.sizeBytes) || manifest.sizeBytes <= 0) problems.push(`sizeBytes 非法：${manifest.sizeBytes}`);
  if (!/^[0-9a-f]{64}$/.test(String(manifest.sha256 ?? ""))) problems.push(`sha256 非法：${manifest.sha256}`);
  if (manifest.releaseNotes.length === 0) problems.push("releaseNotes 为空（升级弹窗会没有说明）");

  if (Number.isFinite(apkSizeBytes) && apkSizeBytes !== manifest.sizeBytes) {
    problems.push(`sizeBytes 与 APK 不一致：清单 ${manifest.sizeBytes} / 实际 ${apkSizeBytes}`);
  }
  if (apkSha256 && apkSha256 !== manifest.sha256) {
    problems.push(`sha256 与 APK 不一致：清单 ${manifest.sha256} / 实际 ${apkSha256}`);
  }
  return problems;
}
