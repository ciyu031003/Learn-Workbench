import * as SecureStore from "expo-secure-store";

/**
 * 登录令牌安全存储：Keychain (iOS) / Keystore (Android)。
 * AsyncStorage 里的持久化 state 不再包含 token（partialize 置空）。
 */
const KEY = "lwb_auth_token";

export const secureToken = {
  async save(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEY, token);
    } catch {
      // 设备不支持时降级：仅保留内存态（登录态到重启失效）
    }
  },
  async load(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // 忽略
    }
  },
};
