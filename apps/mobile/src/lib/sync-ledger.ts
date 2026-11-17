import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { RATING_OUTBOX_KEY } from "@/lib/exam-408-cards";
import { OUTBOX_KEY as NUTRITION_OUTBOX_KEY } from "@/lib/nutrition-outbox";
import {
  countArray,
  countOps,
  EMPTY_SYNC_LEDGER,
  summarizeLedger,
  type SyncLedger,
} from "@/lib/sync-ledger-core";
import { getSyncEngineStatus, useSyncEngineStatus } from "@/lib/sync-engine";
import { UPLOAD_OUTBOX_KEY } from "@/lib/upload-outbox";
import { useAppStore, type SyncChange } from "@/store/app-store";

/**
 * 同步账本（P4 · 架构项 7.1）：把 5 条互不相识的离线通道聚合成**一个只读状态面**。
 *
 * 约束：
 *  - 只读聚合，不改任何通道的存储、协议、重试策略；
 *  - 某通道读取失败 → loaded=false（UI 不能把 0 当"已同步"）；
 *  - 账本是投影不是真相：pendingChanges 仍以 store 为准。
 *
 * 纯聚合逻辑在 sync-ledger-core.ts（可单测），这里只负责 IO 与订阅。
 */
export { describeLedger, summarizeLedger, EMPTY_SYNC_LEDGER } from "@/lib/sync-ledger-core";
export type { SyncChannel, SyncLedgerInput, SyncLedger } from "@/lib/sync-ledger-core";

/** 学习答题队列（learning-sync 内部 key）与错题动作队列（learning-review 内部 key） */
const LEARNING_ATTEMPT_QUEUE_KEY = "lwb-learning-attempt-sync-v1";
const LEARNING_ACTION_QUEUE_KEY = "lwb-learning-review-actions-v1";

function oldestOf(changes: SyncChange[]): string | null {
  let oldest: string | null = null;
  for (const change of changes) {
    const at = change.updatedAt;
    if (!at) continue;
    if (oldest === null || at < oldest) oldest = at;
  }
  return oldest;
}

export async function loadSyncLedger(): Promise<SyncLedger> {
  const state = useAppStore.getState();
  const business = state.pendingChanges ?? [];
  try {
    const [nutritionRaw, uploadRaw, attemptsRaw, actionsRaw, examRaw] = await Promise.all([
      AsyncStorage.getItem(NUTRITION_OUTBOX_KEY),
      AsyncStorage.getItem(UPLOAD_OUTBOX_KEY),
      AsyncStorage.getItem(LEARNING_ATTEMPT_QUEUE_KEY),
      AsyncStorage.getItem(LEARNING_ACTION_QUEUE_KEY),
      AsyncStorage.getItem(RATING_OUTBOX_KEY),
    ]);
    const nutrition = countOps(nutritionRaw);
    const upload = countOps(uploadRaw);
    const attempts = countArray(attemptsRaw);
    const actions = countArray(actionsRaw);
    const exam408 = countOps(examRaw);
    if ([nutrition, upload, attempts, actions, exam408].some((n) => n === null)) {
      return { ...EMPTY_SYNC_LEDGER, total: business.length };
    }
    return summarizeLedger({
      businessCount: business.length,
      businessOldestAt: oldestOf(business),
      nutrition: nutrition ?? 0,
      upload: upload ?? 0,
      learning: (attempts ?? 0) + (actions ?? 0),
      exam408: exam408 ?? 0,
    });
  } catch {
    return { ...EMPTY_SYNC_LEDGER };
  }
}

/**
 * 账本 Hook：挂载读一次；待同步数变化 / 同步引擎同步态变化 / 回到前台时重算。
 * null = 还没读到（UI 显示「—」，不要显示 0）。
 */
export function useSyncLedger(): SyncLedger | null {
  const pendingCount = useAppStore((s) => s.pendingChanges.length);
  const engine = useSyncEngineStatus();
  const [ledger, setLedger] = useState<SyncLedger | null>(null);

  const refresh = useCallback(() => {
    let alive = true;
    void loadSyncLedger().then((next) => {
      if (alive) setLedger(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => refresh(), [refresh, pendingCount, engine.syncing]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") refresh();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [refresh]);

  return ledger;
}

export function currentSyncState() {
  return getSyncEngineStatus();
}
