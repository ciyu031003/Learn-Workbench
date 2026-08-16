import Constants from "expo-constants";
import { useAppStore } from "@/store/app-store";

/** 后端地址：Android 模拟器通过 10.0.2.2 访问宿主机 localhost；真机请改为局域网 IP */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const DEFAULT_API_URL = extra.apiUrl ?? "http://10.0.2.2:3000";

/** 运行时服务器地址：设置页可覆盖（真机联调用） */
export function getApiUrl(): string {
  const custom = useAppStore.getState().apiUrl;
  if (custom && custom.trim()) return custom.trim().replace(/\/+$/, "");
  return DEFAULT_API_URL;
}
