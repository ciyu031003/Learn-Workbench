import { API_URL } from "@/config";
import { useAppStore, type SyncPayload } from "@/store/app-store";

export async function apiLogin(
  username: string,
  password: string
): Promise<{ token: string; user: { username: string } }> {
  const r = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "登录失败");
  return data;
}

export function buildSyncPayload(): SyncPayload {
  const s = useAppStore.getState();
  return {
    progress: Object.values(s.progress).map((p) => ({
      topicId: p.topicId,
      done: p.done,
      note: p.note,
      updatedAt: p.updatedAt,
    })),
    tasks: s.tasks,
    sessions: s.sessions,
    checkins: s.checkins.map((d) => ({ checkinDate: d, note: null })),
    logs: s.logs,
    certificates: [],
    github: s.github,
    customTopics: s.customTopics,
  };
}

export async function syncPush(token: string): Promise<void> {
  const payload = buildSyncPayload();
  const r = await fetch(`${API_URL}/api/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "同步失败");
}

export async function syncPull(token: string): Promise<SyncPayload> {
  const r = await fetch(`${API_URL}/api/sync/pull`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "拉取失败");
  return data;
}
