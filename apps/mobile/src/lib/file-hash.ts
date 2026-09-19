import * as LegacyFileSystem from "expo-file-system/legacy";
import { createSha256Stream } from "./sha256";

/**
 * 文件哈希（OTA 安装包校验用）。
 *
 * 为什么不用 `File.arrayBuffer()`：67MB 一次性读进内存，低端机会被系统杀掉；
 * 这里用 legacy 的 `readAsStringAsync({ position, length })` 分片读 + 纯 TS 增量 sha256，
 * 内存恒定在 1 个分片（512KB）。legacy API 在 SDK 57 仍随包提供（新 API 没有分片读）。
 */
const CHUNK_BYTES = 512 * 1024;

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) table[BASE64_ALPHABET.charCodeAt(i)] = i;
  return table;
})();

/** 解码 base64（忽略换行与 `=` 填充；RN 里没有可靠的 atob） */
export function decodeBase64(input: string): Uint8Array {
  const out = new Uint8Array(Math.floor((input.length * 3) / 4));
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i++) {
    const value = BASE64_LOOKUP[input.charCodeAt(i) & 0xff];
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, outIndex);
}

/** 文件字节数（不存在返回 0） */
export async function readFileSize(uri: string): Promise<number> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri);
    if (!info.exists) return 0;
    return Number((info as { size?: number }).size) || 0;
  } catch {
    return 0;
  }
}

/**
 * 分片计算文件的 sha256（小写十六进制）。
 * `sizeHint` 已知时传入可少一次 stat；`onProgress` 用于「正在校验…」进度。
 */
export async function hashFileSha256(
  uri: string,
  sizeHint = 0,
  onProgress?: (hashedBytes: number, totalBytes: number) => void
): Promise<string> {
  const total = sizeHint > 0 ? sizeHint : await readFileSize(uri);
  const stream = createSha256Stream();
  let position = 0;
  for (;;) {
    const length = total > 0 ? Math.min(CHUNK_BYTES, total - position) : CHUNK_BYTES;
    if (length <= 0) break;
    const base64 = await LegacyFileSystem.readAsStringAsync(uri, { encoding: "base64", position, length });
    const bytes = decodeBase64(base64);
    if (bytes.length === 0) break;
    stream.push(bytes);
    position += bytes.length;
    onProgress?.(position, total || position);
    if (bytes.length < length) break;
  }
  return stream.hex();
}
