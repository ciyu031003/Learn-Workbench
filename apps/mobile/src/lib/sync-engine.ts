import { useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";
import { syncPull, syncPush } from "@/lib/sync";
import { useAppStore } from "@/store/app-store";

/**
 * 离线优先同步引擎：
 * - 所有写操作先落本机（AsyncStorage），并进入 pendingChanges 队列；
 * - 监听网络状态：连上 WiFi / 移动网络后自动 push + pull；
 * - 监听前后台：回到 App 时补一次同步；
 * - 本地有新变更且在线时，防抖 4s 自动上传。
 */
export interface SyncEngineStatus {
  online: boolean;
  syncing: boolean;
  lastError: string | null;
}

let status: SyncEngineStatus = { online: false, syncing: false, lastError: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncEngineStatus>) {
  const next = { ...status, ...patch };
  if (next.online === status.online && next.syncing === status.syncing && next.lastError === status.lastError) return;
  status = next;
  listeners.forEach((l) => l());
}

export function useSyncEngineStatus(): SyncEngineStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => status
  );
}

let started = false;
let running = false;
let debounce: ReturnType<typeof setTimeout> | null = null;

function isOnlineState(state: Network.NetworkState): boolean {
  return state.type !== Network.NetworkStateType.NONE && state.isInternetReachable !== false;
}

async function runSync(): Promise<void> {
  const s = useAppStore.getState();
  if (running || !status.online || !s.token) return;
  running = true;
  setStatus({ syncing: true, lastError: null });
  try {
    await syncPush(s.token);
    await syncPull(s.token);
  } catch (e) {
    // 失败不阻塞：变更仍保留在本地队列，等待下次联网重试
    setStatus({ lastError: e instanceof Error ? e.message : "同步失败" });
  } finally {
    running = false;
    setStatus({ syncing: false });
  }
}

async function refreshOnline(): Promise<void> {
  try {
    const state = await Network.getNetworkStateAsync();
    const online = isOnlineState(state);
    const was = status.online;
    setStatus({ online });
    if (online && !was) void runSync();
  } catch {
    // 取不到网络状态时保持现状
  }
}

export function scheduleSync(delayMs = 4000): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void runSync();
  }, delayMs);
}

export function startSyncEngine(): () => void {
  if (started) return () => undefined;
  started = true;

  void refreshOnline();

  const netSub = Network.addNetworkStateListener((state) => {
    const online = isOnlineState(state);
    const was = status.online;
    setStatus({ online });
    if (online && !was) void runSync();
  });

  const appSub = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "active") {
      void refreshOnline();
      void runSync();
    }
  });

  const storeUnsub = useAppStore.subscribe((s, prev) => {
    if (s.token && s.token !== prev.token) {
      void runSync();
    } else if (s.token && s.pendingChanges.length > prev.pendingChanges.length) {
      scheduleSync();
    }
  });

  return () => {
    netSub.remove();
    appSub.remove();
    storeUnsub();
    if (debounce) clearTimeout(debounce);
    debounce = null;
    started = false;
  };
}
