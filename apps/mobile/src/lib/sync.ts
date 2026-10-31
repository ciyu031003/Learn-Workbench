import { getApiUrl } from "@/config";
import { noteServerTime } from "@/lib/sync-clock";
import { useAppStore, type SyncChange } from "@/store/app-store";

export async function apiLogin(
  username: string,
  password: string
): Promise<{ token: string; user: { username: string } }> {
  const r = await fetch(`${getApiUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "登录失败");
  return data;
}

/** 服务端单批变更上限（/api/sync/push 超限返回 413） */
const PUSH_BATCH_SIZE = 500;

/** pull 循环翻页的安全上限（500/页 × 500 页 = 25 万条，正常永远到不了；防服务端异常时死循环） */
const MAX_PULL_PAGES = 500;

/** rejected/apply_failed 的连续重试上限（防毒丸：确定性失败的变更不无限重推） */
const MAX_APPLY_FAILURES = 3;

/** 只接受服务端给的合法时间戳：非法值绝不写进游标（否则下次 pull 的 since 无效、会重拉全量或漏拉） */
export function isValidServerTime(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(new Date(value).getTime());
}

/** 把服务端时间落成游标（S5-3：游标唯一可信来源 = serverTime） */
function advanceCursor(serverTime: unknown): void {
  if (!isValidServerTime(serverTime)) return;
  useAppStore.getState().setLastSyncedAt(serverTime);
  noteServerTime(serverTime);
}

/** push 响应的逐条回执（契约见 packages/shared/src/sync.ts syncPushReceiptSchema） */
interface SyncReceipt {
  changeId: string | null;
  index: number;
  result: "applied" | "stale" | "rejected";
  reason: string;
  seq: number | null;
}

/**
 * apply_failed 的连续失败计数（changeId → 次数）。
 * 只在内存里记：应用重启归零多推几次无害（服务端 applier 幂等 upsert）。
 */
const applyFailures = new Map<string, number>();

/**
 * 增量 Push：本地 pending changes 分批发送（§37-§40），失败批次留待重试。
 *
 * S5-3 修正：空队列不推进游标、游标只认响应 serverTime、推送期间新增的变更不受影响。
 * v2.1 修正（评审 2026-10-31）：此前 r.ok 即整批清出，`rejected/apply_failed` 的条目被
 * 静默丢出发件箱 = 永久丢这条变更。现在按回执逐条处置：
 *  - applied / stale（含 duplicate：changeId 已应用或远端已更新）→ 清出；
 *  - rejected + apply_failed → 保留重试，连续 MAX_APPLY_FAILURES 次后丢弃并告警（防毒丸）；
 *  - rejected + 确定性原因（unknown_entity_type / invalid_entity_id 等）→ 清出 + 告警；
 *  - 服务端未返回 receipts（老版本服务端）→ 保守清出（保持旧行为）。
 */
export async function syncPush(token: string): Promise<void> {
  const s = useAppStore.getState();
  const pending: SyncChange[] = s.pendingChanges;
  if (pending.length === 0) return;

  let serverTime: unknown = null;
  for (let i = 0; i < pending.length; i += PUSH_BATCH_SIZE) {
    const batch = pending.slice(i, i + PUSH_BATCH_SIZE);
    const r = await fetch(`${getApiUrl()}/api/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deviceId: s.deviceId, deviceName: "mobile", changes: batch }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "同步失败");

    const toClear: SyncChange[] = [];
    const receipts: SyncReceipt[] | null = Array.isArray(data.receipts) ? data.receipts : null;
    if (!receipts) {
      // 老服务端没有逐条回执：保持旧行为（整批清出）
      toClear.push(...batch);
    } else {
      const byIndex = new Map(receipts.map((rc) => [rc.index, rc]));
      for (let j = 0; j < batch.length; j += 1) {
        const change = batch[j];
        const rc = byIndex.get(j);
        if (!rc) {
          // 服务端对每条必有回执；缺失视为异常防御，按已应用处理
          toClear.push(change);
          continue;
        }
        if (rc.result === "applied" || rc.result === "stale") {
          if (rc.changeId) applyFailures.delete(rc.changeId);
          toClear.push(change);
          continue;
        }
        // rejected：区分"服务端瞬时失败（可重试）"与"确定性拒绝（重试无意义）"
        if (rc.reason === "apply_failed" && rc.changeId) {
          const failures = (applyFailures.get(rc.changeId) ?? 0) + 1;
          if (failures >= MAX_APPLY_FAILURES) {
            applyFailures.delete(rc.changeId);
            console.warn(`[sync] 变更连续 ${failures} 次应用失败，已丢弃防阻塞队列：`, rc.changeId);
            toClear.push(change);
          } else {
            applyFailures.set(rc.changeId, failures);
            // 不入 toClear：留在发件箱等待下轮重试
          }
          continue;
        }
        if (rc.changeId) applyFailures.delete(rc.changeId);
        console.warn(`[sync] 变更被服务端拒绝（${rc.reason}），丢弃：`, rc.changeId ?? change.entityId);
        toClear.push(change);
      }
    }
    if (toClear.length > 0) useAppStore.getState().clearPendingChanges(toClear);
    if (isValidServerTime(data.serverTime)) serverTime = data.serverTime;
  }
  if (serverTime) advanceCursor(serverTime);
}

/**
 * 增量 Pull（v2.1，ledger 单源）：按 seq 游标顺序回放 sync_changes 并本地 LWW 合并。
 *
 * 为什么从「实体表 + updated_at 时间窗」迁移（评审 2026-10-31 P0/P1/P2）：
 *  - push 采纳客户端 updatedAt，设备离线补传旧时间戳变更时，时间窗游标已越过该时刻
 *    → 其他设备永远拉不到；seq 是"写入即到达"，与业务时间戳解耦；
 *  - 服务端 500/页截断，旧实现不跟随 hasMore/cursor → 超过 500 条变更被静默丢弃
 *    （新设备首登/长期离线必触发）；现在循环翻页到取完为止；
 *  - 每页立即持久化 lastSeq：中断重拉已应用页次（LWW 幂等），不丢进度。
 *
 * 修剪兜底：维护任务按 90 天裁剪 ledger；`ledgerMinSeq > seq + 1`（且 seq>0）说明
 * 本机游标已被裁剪越过 → 重置 0 全量重拉。serverTime 只在本轮取完后推进（S5-3 纪律）。
 */
export async function syncPull(token: string): Promise<void> {
  const state = useAppStore.getState();
  let seq = state.lastSyncedSeq ?? 0;

  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const url =
      `${getApiUrl()}/api/sync/pull?deviceId=${encodeURIComponent(state.deviceId)}&deviceName=mobile` +
      `&sinceSeq=${encodeURIComponent(String(seq))}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "拉取失败");

    const changes: SyncChange[] = Array.isArray(data.changes) ? data.changes : [];
    if (changes.length > 0) useAppStore.getState().applyRemoteChanges(changes);

    // 修剪检测：先于 lastSeq 推进，避免把"已被裁剪的窗口"当成已同步
    const minSeq = typeof data.ledgerMinSeq === "number" && Number.isFinite(data.ledgerMinSeq) ? data.ledgerMinSeq : 0;
    if (seq > 0 && minSeq > seq + 1) {
      seq = 0;
      useAppStore.getState().setLastSyncedSeq(0);
      continue;
    }

    const lastSeq = typeof data.lastSeq === "number" && Number.isFinite(data.lastSeq) && data.lastSeq >= 0 ? data.lastSeq : null;
    if (lastSeq !== null) {
      useAppStore.getState().setLastSyncedSeq(lastSeq);
      seq = lastSeq;
    }

    if (data.hasMore !== true || typeof data.cursor !== "string") {
      // 本轮取完才推进 serverTime 游标（展示/legacy 兜底用；拉取进度以 seq 为准）
      if (isValidServerTime(data.serverTime)) advanceCursor(data.serverTime);
      return;
    }
  }
  throw new Error("拉取页数超过安全上限");
}
