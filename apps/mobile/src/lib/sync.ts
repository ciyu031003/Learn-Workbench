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

/**
 * 增量 Push：本地 pending changes 分批发送（§37-§40），逐批清除已成功项，失败批次留待重试。
 *
 * S5-3 修正：
 *  1) **空队列不推进游标**（旧实现写本机 now()：设备时钟快 1h 时，下次 pull 的 since 就跳到未来，
 *     服务端漏发这 1h 的远端变更）；
 *  2) 游标只取响应里的 serverTime；
 *  3) 推送期间新产生的变更不受影响（clearPendingChanges 按引用精确移除本批）。
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
    // 快照里的对象引用与 store 一致，精确移除本批；推送期间新增的变更不受影响
    useAppStore.getState().clearPendingChanges(batch);
    if (isValidServerTime(data.serverTime)) serverTime = data.serverTime;
  }
  if (serverTime) advanceCursor(serverTime);
}

/**
 * 增量 Pull：按 since 游标拉取远端变更并本地 LWW 合并。
 *
 * S5-3：since 只来自上一条 serverTime（不掺本机时钟）——设备时钟 +1h 也不会把 since 推到未来，
 * 仍是「上次服务端时间」之后的变更（本次修复的关键回归点）。
 */
export async function syncPull(token: string): Promise<void> {
  const s = useAppStore.getState();
  const since = s.lastSyncedAt ?? "";
  const url = `${getApiUrl()}/api/sync/pull?deviceId=${encodeURIComponent(s.deviceId)}&deviceName=mobile&since=${encodeURIComponent(since)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "拉取失败");
  const changes: SyncChange[] = Array.isArray(data.changes) ? data.changes : [];
  if (changes.length > 0) useAppStore.getState().applyRemoteChanges(changes);
  if (isValidServerTime(data.serverTime)) advanceCursor(data.serverTime);
}
