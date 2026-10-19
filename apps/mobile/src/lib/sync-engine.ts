import { useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";
import { syncPull, syncPush } from "@/lib/sync";
import { getServerClockOffsetMs, hasServerClockSample } from "@/lib/sync-clock";
import { flushNutritionOutbox } from "@/lib/nutrition-sync";
import { flushUploadOutbox } from "@/lib/upload-sync";
import { selectForeignPendingChanges, useAppStore } from "@/store/app-store";

/**
 * 离线优先同步引擎（S5-3 v2）：
 * - 所有写操作先落本机（AsyncStorage），并进入 pendingChanges 队列；
 * - 监听网络状态：连上 WiFi / 移动网络后自动 push + pull；
 * - 监听前后台：回到 App 时补一次同步；
 * - 本地有新变更且在线时，防抖 4s 自动上传；
 * - **失败退避**：2s → 8s → 30s → 2min（此后保持 2min），成功或手动触发即重置；
 * - **dirty 补跑**：提交期间新产生的变更不会丢——本轮结束立刻再跑一轮（不是等 4s 防抖）；
 * - 状态（待同步由 store 提供 / 上次失败原因 / 重试倒计时 / 时钟偏移）供「我的 → 数据同步」展示。
 */
export interface SyncEngineStatus {
  online: boolean;
  syncing: boolean;
  /** 上次失败原因；成功后清空。失败后即使空闲也保留，供状态条展示 */
  lastError: string | null;
  /** 已连续失败次数（0 = 当前无待重试） */
  retryAttempt: number;
  /** 距离下一次自动重试的毫秒数（null = 未排期） */
  retryInMs: number | null;
  /** 服务器时间 - 设备时间（ms）；未采样为 null */
  clockOffsetMs: number | null;
  /** running 期间收到了新变更/新触发，本轮结束后需要补跑 */
  dirty: boolean;
}

/** 失败退避序列（S5-3）：2s / 8s / 30s / 2min；之后保持 2min */
export const RETRY_DELAYS_MS = [2000, 8000, 30000, 120000] as const;

/** 第 n 次连续失败后的重试间隔 */
export function nextRetryDelayMs(failureCount: number): number {
  const index = Math.min(Math.max(failureCount, 1), RETRY_DELAYS_MS.length) - 1;
  return RETRY_DELAYS_MS[index];
}

const EMPTY_STATUS: SyncEngineStatus = {
  online: false,
  syncing: false,
  lastError: null,
  retryAttempt: 0,
  retryInMs: null,
  clockOffsetMs: null,
  dirty: false,
};

let status: SyncEngineStatus = { ...EMPTY_STATUS };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncEngineStatus>): void {
  const next = { ...status, ...patch };
  if (
    next.online === status.online &&
    next.syncing === status.syncing &&
    next.lastError === status.lastError &&
    next.retryAttempt === status.retryAttempt &&
    next.retryInMs === status.retryInMs &&
    next.clockOffsetMs === status.clockOffsetMs &&
    next.dirty === status.dirty
  ) {
    return;
  }
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

/** 非 Hook 读取（测试/命令式 UI 用） */
export function getSyncEngineStatus(): SyncEngineStatus {
  return status;
}

let started = false;
let running = false;
let dirty = false;
let failureCount = 0;
let debounce: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function isOnlineState(state: Network.NetworkState): boolean {
  return state.type !== Network.NetworkStateType.NONE && state.isInternetReachable !== false;
}

/**
 * 换账号保护（S1-6）：丢弃不属于当前账号的待同步变更，返回丢弃条数。
 *
 * 为什么必须有：A 的离线队列若在 B 登录后仍留在 pendingChanges，会被以 B 的 Bearer
 * 推到 /api/sync/push —— 既污染 B 的云端数据，也把 A 的记录暴露给 B。
 * 诊断记录：console.warn（真机 logcat / 开发面板可查）+ status.lastError（同步状态可见）。
 */
export function discardForeignPendingChanges(reason: string): number {
  const s = useAppStore.getState();
  const foreign = selectForeignPendingChanges(s.pendingChanges, s.ownerUserId);
  if (foreign.length === 0) return 0;
  useAppStore.getState().clearPendingChanges(foreign);
  const fromOwner = foreign[0]?.ownerUserId ?? "未知";
  const message =
    "已丢弃 " + foreign.length + " 条不属于当前账号（" + (s.ownerUserId ?? "未登录") + "）的待同步变更（原账号 " + fromOwner + "）：" + reason;
  console.warn("[sync-engine]", message);
  setStatus({ lastError: message });
  return foreign.length;
}

function clockOffsetPatch(): Partial<SyncEngineStatus> {
  return hasServerClockSample() ? { clockOffsetMs: getServerClockOffsetMs() } : {};
}

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (status.retryInMs !== null) setStatus({ retryInMs: null });
}

function scheduleRetry(): void {
  clearRetryTimer();
  if (!status.online) {
    // 离线时不排重试：联网事件会立刻触发一次同步
    setStatus({ retryAttempt: failureCount, retryInMs: null });
    return;
  }
  const delay = nextRetryDelayMs(failureCount);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void runSync();
  }, delay);
  setStatus({ retryAttempt: failureCount, retryInMs: delay });
  console.warn(`[sync-engine] 同步失败，${Math.round(delay / 1000)}s 后自动重试（连续第 ${failureCount} 次）`);
}

async function runSync(): Promise<void> {
  if (running) {
    // S5-3 dirty：本轮还没结束就又需要同步 → 结束后补跑，绝不丢提交期间的新变更
    dirty = true;
    setStatus({ dirty: true });
    return;
  }
  const initial = useAppStore.getState();
  if (!status.online || !initial.token) return;

  clearRetryTimer();
  // 推前最后一道校验：即使订阅回调被绕过，也绝不用当前 Bearer 推旧账号的发件箱
  discardForeignPendingChanges("push 前校验");

  running = true;
  dirty = false;
  setStatus({ syncing: true, dirty: false });
  let failure: unknown = null;

  try {
    do {
      dirty = false;
      const token = useAppStore.getState().token;
      if (!token) break; // 同步期间被登出：立即停止，不拿旧 token 继续
      await syncPush(token);
      await syncPull(token);
      // 本轮 push/pull 都成功：清掉退避计数与失败原因
      failureCount = 0;
      setStatus({ lastError: null, retryAttempt: 0, retryInMs: null, ...clockOffsetPatch() });
    } while (dirty);
  } catch (e) {
    failure = e;
    failureCount += 1;
    setStatus({
      lastError: e instanceof Error ? e.message : "同步失败",
      ...clockOffsetPatch(),
    });
  } finally {
    running = false;
    setStatus({ syncing: false, dirty });
    if (failure) {
      scheduleRetry();
    } else if (dirty) {
      // 极窄窗口：循环退出条件检查之后、finally 之前又来了变更 → 立即补跑
      void runSync();
    }
  }
}

/** 命令式触发一次同步（设置页「同步到云端」/测试）；running 时只置 dirty */
export function requestSync(): void {
  void runSync();
}

/** 网络恢复 / 回前台时的统一动作：推拉业务变更 + 补发饮食与图片发件箱（后两者不依赖业务同步成功） */
function onOnlineOrForeground(): void {
  void runSync();
  const token = useAppStore.getState().token;
  void flushNutritionOutbox(token);
  void flushUploadOutbox(token);
}

async function refreshOnline(): Promise<void> {
  try {
    const state = await Network.getNetworkStateAsync();
    const online = isOnlineState(state);
    const was = status.online;
    setStatus({ online });
    if (!online) {
      clearRetryTimer();
      return;
    }
    if (!was) onOnlineOrForeground();
  } catch {
    // 取不到网络状态时保持现状
  }
}

/** 防抖同步（本地新增变更后 4s 自动上传） */
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
    if (!online) {
      clearRetryTimer();
    } else if (!was) {
      onOnlineOrForeground();
    }
  });

  const appSub = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "active") {
      void refreshOnline();
      onOnlineOrForeground();
    }
  });

  const storeUnsub = useAppStore.subscribe((s, prev) => {
    if (s.token && s.token !== prev.token) {
      // 登录/换账号：先按 ownerUserId 丢弃旧账号队列，再触发同步（runSync 内还有一次校验）
      discardForeignPendingChanges("token 变化");
      void runSync();
      return;
    }
    if (!s.token && prev.token) {
      // 登出：停止自动同步与退避（新账号登录会重新触发）
      clearRetryTimer();
      return;
    }
    if (s.pendingChanges.length > prev.pendingChanges.length) {
      if (running) {
        dirty = true;
        setStatus({ dirty: true });
      } else {
        scheduleSync();
      }
    }
  });

  return () => {
    netSub.remove();
    appSub.remove();
    storeUnsub();
    if (debounce) clearTimeout(debounce);
    debounce = null;
    clearRetryTimer();
    started = false;
  };
}

/** 测试用：复位引擎内部状态（不影响 store） */
export function __resetSyncEngineForTests(): void {
  if (debounce) clearTimeout(debounce);
  debounce = null;
  clearRetryTimer();
  running = false;
  dirty = false;
  failureCount = 0;
  started = false;
  status = { ...EMPTY_STATUS };
}
