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
  /**
   * 带超时的读取：部分 ROM（如 ColorOS）的 Keystore 在冷启动时可能长时间不返回，
   * 超时按"未登录"处理，保证启动链路永远不会被安全存储卡住。
   */
  async loadWithTimeout(ms = 3000): Promise<string | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.load(),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), ms);
        }),
      ]);
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
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
