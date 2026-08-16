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

/** 增量 Push：只发送本地 pending changes（§37-§40），成功后清空 */
export async function syncPush(token: string): Promise<void> {
  const s = useAppStore.getState();
  const changes: SyncChange[] = s.pendingChanges;
  if (changes.length === 0) {
    useAppStore.getState().setLastSyncedAt(new Date().toISOString());
    return;
  }
  const r = await fetch(`${getApiUrl()}/api/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deviceId: s.deviceId, deviceName: "mobile", changes }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "同步失败");
  useAppStore.getState().clearPendingChanges();
  if (data.serverTime) useAppStore.getState().setLastSyncedAt(data.serverTime);
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
