/**
 * 用户可见的错误文案（唯一入口）。
 *
 * 目标：
 * - 网络层英文错误（Failed to fetch / Network request failed / timeout）绝不直接上屏；
 * - 服务端返回的中文业务提示（如「昵称需为 1–20 个字符」）保留，方便用户改；
 * - 其余未知错误统一回落到调用方给的中文兜底句。
 */

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /network request failed/i,
  /load failed/i,
  /networkerror/i,
  /econnrefused/i,
  /econnreset/i,
  /socket hang up/i,
  /timed?\s*out/i,
  /aborted/i,
  /you are offline/i,
];

const SERVER_PATTERNS = [
  /^internal server error$/i,
  /^bad gateway$/i,
  /^service unavailable$/i,
  /^gateway time-?out$/i,
  /^http\s*5\d\d/i,
  /^5\d\d$/,
  /unexpected token/i,
];

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function friendlyErrorMessage(raw: string, fallback: string): string {
  const text = raw.trim();
  if (!text) return fallback;
  if (NETWORK_PATTERNS.some((pattern) => pattern.test(text))) {
    return "网络连接失败，请检查网络后重试";
  }
  if (SERVER_PATTERNS.some((pattern) => pattern.test(text))) {
    return "服务暂时不可用，请稍后重试";
  }
  // 站内 API 的中文校验/业务提示（短句）可以保留；长报错与英文堆栈一律不露给用户。
  if (hasChinese(text) && Array.from(text).length <= 60) return text;
  return fallback;
}

export function friendlyError(error: unknown, fallback: string): string {
  const raw =
    typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return friendlyErrorMessage(raw, fallback);
}
