import Constants from "expo-constants";
import { useAppStore } from "@/store/app-store";

/**
 * 后端地址优先级：
 *   1) 运行时覆盖（store.apiUrl，仅调试用）
 *   2) EXPO_PUBLIC_API_URL（构建/启动时注入，见 app.config.js）
 *   3) app.json extra.apiUrl（默认生产域名 https://learn.yuanabd.cn）
 *   4) 本地开发兜底（模拟器访问宿主机）
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

const FALLBACK = "http://10.0.2.2:3001";
/** 正式包强制使用的 https 地址（任何 http 配置都会被它替换，见下） */
export const PRODUCTION_API_URL = "https://learn.yuanabd.cn";

export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || FALLBACK;

/**
 * 开发模式判定：RN 打包器会注入 `__DEV__`；测试或其它环境未定义时按"开发"处理
 * （宁可放过明文地址，也不要在联调时把地址悄悄改掉）。
 */
const IS_DEV = typeof __DEV__ === "undefined" ? true : __DEV__;

/**
 * v4 P2（决策 D7）：**正式包只允许 https**。
 *
 * 原因：正式包清单里 `usesCleartextTraffic=false`，任何 `http://` 请求都会被系统直接拒绝
 * （RN 表现为 "Network request failed"）。历史上这类失败会被上层统一报成
 * 「当前网络不可用」，害得排查方向完全跑偏（用户明明开着流量）。
 * 所以：非开发环境下，只要目标地址是 http:// 就回落到生产 https 域名。
 */
export function sanitizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return PRODUCTION_API_URL;
  if (!IS_DEV && /^http:\/\//i.test(trimmed)) return PRODUCTION_API_URL;
  return trimmed;
}

/** 运行时服务器地址：调试时可覆盖；正式包强制 https */
export function getApiUrl(): string {
  const custom = useAppStore.getState().apiUrl;
  if (custom && custom.trim()) return sanitizeApiUrl(custom);
  return sanitizeApiUrl(DEFAULT_API_URL);
}
