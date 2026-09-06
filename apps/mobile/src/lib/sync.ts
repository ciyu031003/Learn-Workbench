import { getApiUrl } from "@/config";
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

/** 增量 Push：本地 pending changes 分批发送（§37-§40），逐批清除已成功项，失败批次留待重试 */
export async function syncPush(token: string): Promise<void> {
  const s = useAppStore.getState();
  const pending: SyncChange[] = s.pendingChanges;
  if (pending.length === 0) {
    useAppStore.getState().setLastSyncedAt(new Date().toISOString());
    return;
  }
  let serverTime: string | null = null;
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
    if (data.serverTime) serverTime = data.serverTime;
  }
  if (serverTime) useAppStore.getState().setLastSyncedAt(serverTime);
}

/** 增量 Pull：按 since 游标拉取远端变更并本地 LWW 合并 */
export async function syncPull(token: string): Promise<void> {
  const s = useAppStore.getState();
  const since = s.lastSyncedAt ?? "";
  const url = `${getApiUrl()}/api/sync/pull?deviceId=${encodeURIComponent(s.deviceId)}&deviceName=mobile&since=${encodeURIComponent(since)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "拉取失败");
  const changes: SyncChange[] = Array.isArray(data.changes) ? data.changes : [];
  if (changes.length > 0) useAppStore.getState().applyRemoteChanges(changes);
  if (data.serverTime) useAppStore.getState().setLastSyncedAt(data.serverTime);
}
