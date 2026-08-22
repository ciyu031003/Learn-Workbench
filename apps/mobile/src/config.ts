import Constants from "expo-constants";
import { useAppStore } from "@/store/app-store";

/**
 * 后端地址优先级：
 *   1) EXPO_PUBLIC_API_URL（构建/启动时注入，见 app.config.js）
 *   2) app.json extra.apiUrl（默认生产域名 https://learn.yuanabd.cn）
 *   3) 本地开发兜底
 * 设置页可运行时覆盖（存本地）。
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "http://10.0.2.2:3001";

/** 运行时服务器地址：设置页可覆盖（真机联调用） */
export function getApiUrl(): string {
  const custom = useAppStore.getState().apiUrl;
  if (custom && custom.trim()) return custom.trim().replace(/\/+$/, "");
  return DEFAULT_API_URL;
}