import { describe, it, expect, vi, beforeEach } from "vitest";

// sync-engine 只依赖这些原生模块的「事件订阅 + 状态读取」接口，单测里全部替身。
vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock("expo-network", () => ({
  NetworkStateType: { NONE: "NONE", WIFI: "WIFI", CELLULAR: "CELLULAR" },
  getNetworkStateAsync: vi.fn().mockResolvedValue({ type: "WIFI", isInternetReachable: true }),
  addNetworkStateListener: vi.fn(() => ({ remove: vi.fn() })),
}));
vi.mock("@/lib/sync", () => ({
  syncPush: vi.fn().mockResolvedValue(undefined),
  syncPull: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/nutrition-sync", () => ({ flushNutritionOutbox: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/upload-sync", () => ({ flushUploadOutbox: vi.fn().mockResolvedValue(undefined) }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import { syncPush } from "@/lib/sync";
import { useAppStore } from "@/store/app-store";
import { discardForeignPendingChanges, startSyncEngine } from "./sync-engine";

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.getState().resetForLogout();
  useAppStore.setState({ token: null, username: null, ownerUserId: null });
});

describe("S1-6 换账号：owner 不匹配的 pending 必须丢弃", () => {
  it("discardForeignPendingChanges 清掉旧账号队列、记诊断且不触发推送", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useAppStore.getState().setAuth("token-a", "alice");
    useAppStore.getState().addTask("A 任务", "study");
    useAppStore.getState().toggleTopic(1);
    expect(useAppStore.getState().pendingChanges).toHaveLength(2);

    // 未走登出，直接换成 B（令牌失效后重新登录 / 换账号）
    useAppStore.getState().setAuth("token-b", "bob");
    const dropped = discardForeignPendingChanges("单测");

    expect(dropped).toBe(2);
    expect(useAppStore.getState().pendingChanges).toEqual([]);
    expect(syncPush).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[sync-engine]", expect.stringContaining("不属于当前账号"));
    warn.mockRestore();
  });

  it("startSyncEngine 的 token 变化订阅会立即清掉旧账号队列", () => {
    const stop = startSyncEngine();
    try {
      useAppStore.getState().setAuth("token-a", "alice");
      useAppStore.getState().addTask("A 任务", "study");
      expect(useAppStore.getState().pendingChanges).toHaveLength(1);

      useAppStore.getState().setAuth("token-b", "bob");
      expect(useAppStore.getState().ownerUserId).toBe("bob");
      expect(useAppStore.getState().pendingChanges).toEqual([]);
    } finally {
      stop();
    }
  });
});
