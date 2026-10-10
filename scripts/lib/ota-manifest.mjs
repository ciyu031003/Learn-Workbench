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

export function apkFileName(versionName) {
  return `learn-workbench-v${versionName}.apk`;
}

export function apkUrlFor(versionName, base = DEFAULT_OTA_BASE) {
  return `${String(base).replace(/\/+$/, "")}/download/${apkFileName(versionName)}`;
}

/**
 * 构造 OTA 清单对象。
 * `publishedAt` 可显式传入（复现/测试用），默认取当前时间。
 */
export function buildOtaManifest(input) {
  const base = input.base ?? DEFAULT_OTA_BASE;
  return {
    versionName: String(input.versionName),
    versionCode: Number(input.versionCode),
    apkUrl: apkUrlFor(input.versionName, base),
    sizeBytes: Number(input.sizeBytes),
    sha256: String(input.sha256),
    releaseNotes: Array.isArray(input.releaseNotes) ? input.releaseNotes : [],
    publishedAt: input.publishedAt ?? new Date().toISOString(),
  };
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
