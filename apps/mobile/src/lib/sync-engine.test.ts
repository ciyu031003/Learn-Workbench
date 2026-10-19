import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  network: { type: "WIFI", isInternetReachable: true },
}));

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock("expo-network", () => ({
  NetworkStateType: { NONE: "NONE", WIFI: "WIFI", CELLULAR: "CELLULAR" },
  getNetworkStateAsync: vi.fn(async () => h.network),
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

import { syncPull, syncPush } from "@/lib/sync";
import { useAppStore } from "@/store/app-store";
import {
  __resetSyncEngineForTests,
  discardForeignPendingChanges,
  getSyncEngineStatus,
  nextRetryDelayMs,
  startSyncEngine,
} from "./sync-engine";

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetSyncEngineForTests();
  vi.mocked(syncPush).mockReset().mockResolvedValue(undefined);
  vi.mocked(syncPull).mockReset().mockResolvedValue(undefined);
  useAppStore.getState().resetForLogout();
  useAppStore.setState({ token: null, username: null, ownerUserId: null });
  h.network = { type: "WIFI", isInternetReachable: true };
});

afterEach(() => {
  __resetSyncEngineForTests();
  vi.useRealTimers();
});

describe("S1-6 换账号：owner 不匹配的 pending 必须丢弃", () => {
  it("discardForeignPendingChanges 清掉旧账号队列、记诊断且不触发推送", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useAppStore.getState().setAuth("token-a", "alice");
    useAppStore.getState().addTask("A 任务", "study");
    useAppStore.getState().toggleTopic(1);
    expect(useAppStore.getState().pendingChanges).toHaveLength(2);

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

describe("S5-3 失败退避", () => {
  it("nextRetryDelayMs 序列 = 2s / 8s / 30s / 2min（之后保持 2min）", () => {
    expect(nextRetryDelayMs(1)).toBe(2000);
    expect(nextRetryDelayMs(2)).toBe(8000);
    expect(nextRetryDelayMs(3)).toBe(30000);
    expect(nextRetryDelayMs(4)).toBe(120000);
    expect(nextRetryDelayMs(9)).toBe(120000);
  });

  it("连续失败按 2s→8s→30s→2min 退避，最后一次成功后清空失败原因", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(syncPush).mockRejectedValue(new Error("网络错误"));
    useAppStore.getState().setAuth("token-a", "alice");
    const stop = startSyncEngine();
    try {
      await flush();
      expect(getSyncEngineStatus().lastError).toContain("网络错误");
      expect(getSyncEngineStatus().retryInMs).toBe(2000);
      expect(getSyncEngineStatus().retryAttempt).toBe(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(getSyncEngineStatus().retryInMs).toBe(8000);
      expect(getSyncEngineStatus().retryAttempt).toBe(2);

      await vi.advanceTimersByTimeAsync(8000);
      expect(getSyncEngineStatus().retryInMs).toBe(30000);

      await vi.advanceTimersByTimeAsync(30000);
      expect(getSyncEngineStatus().retryInMs).toBe(120000);

      // 恢复成功：清空 lastError / 退避
      vi.mocked(syncPush).mockResolvedValue(undefined);
      await vi.advanceTimersByTimeAsync(120000);
      expect(getSyncEngineStatus().lastError).toBeNull();
      expect(getSyncEngineStatus().retryInMs).toBeNull();
      expect(getSyncEngineStatus().retryAttempt).toBe(0);
    } finally {
      stop();
      warn.mockRestore();
    }
  });
});

describe("S5-3 提交期间新增变更（dirty 补跑）", () => {
  it("running 期间新增 pending：本轮结束后立即补跑第二轮 push，不等 4s 防抖", async () => {
    vi.useFakeTimers();
    let releaseFirstPush: (() => void) | null = null;
    const firstPush = new Promise<void>((resolve) => {
      releaseFirstPush = resolve;
    });
    vi.mocked(syncPush)
      .mockImplementationOnce(() => firstPush)
      // 第二轮：模拟真实 syncPush 成功后会清空本批（mock 也要清，否则断言的是假状态）
      .mockImplementation(async () => {
        useAppStore.getState().clearPendingChanges();
      });

    useAppStore.getState().setAuth("token-a", "alice");
    const stop = startSyncEngine();
    try {
      await flush();
      expect(syncPush).toHaveBeenCalledTimes(1);
      expect(getSyncEngineStatus().syncing).toBe(true);

      // 第一轮 push 还没返回，用户又写了一条
      useAppStore.getState().addTask("提交期间新增", "study");
      expect(getSyncEngineStatus().dirty).toBe(true);

      releaseFirstPush!();
      await flush();

      expect(syncPush).toHaveBeenCalledTimes(2);
      expect(syncPull).toHaveBeenCalledTimes(2);
      expect(getSyncEngineStatus().dirty).toBe(false);
      expect(getSyncEngineStatus().syncing).toBe(false);
      // 新变更仍在队列里，且第二轮把它推了出去（不是丢了）
      expect(useAppStore.getState().pendingChanges.length).toBe(0);
    } finally {
      stop();
    }
  });
});
