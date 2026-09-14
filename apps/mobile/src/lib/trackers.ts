import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";

/** 3.0 领域记录（Tracker）客户端：对齐 Web /api/trackers + /api/trackers/logs 线上契约（snake_case） */
function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = useAppStore.getState().token;
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export interface TrackerItem {
  id: number;
  domain_key: string;
  name: string;
  unit: string;
  target_value: number | null;
  target_cadence: "daily" | "weekly" | null;
  color: string;
}

export interface TrackerLogItem {
  id: number;
  tracker_id: number;
  log_date: string;
  value: number;
  note: string | null;
}

/** GET /api/trackers?career=xxx → { trackers } */
export async function fetchTrackers(career: string): Promise<TrackerItem[]> {
  const response = await fetch(
    getApiUrl() + "/api/trackers?career=" + encodeURIComponent(career),
    { headers: authHeaders() }
  );
  if (!response.ok) throw new Error(await readError(response, "记录项加载失败"));
  const data = (await response.json()) as { trackers: TrackerItem[] };
  return Array.isArray(data.trackers) ? data.trackers : [];
}

export interface TrackerUpsertInput {
  id?: number;
  career?: string;
  domainKey?: string;
  name?: string;
  unit?: string;
  targetValue?: number | null;
  targetCadence?: "daily" | "weekly" | null;
  color?: string;
}

/** POST /api/trackers（新建/同键 upsert）；PATCH（传 id 改目标/单位） */
export async function upsertTracker(input: TrackerUpsertInput): Promise<TrackerItem> {
  const isPatch = typeof input.id === "number" && Number.isFinite(input.id);
  const response = await fetch(getApiUrl() + "/api/trackers", {
    method: isPatch ? "PATCH" : "POST",
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, "保存记录项失败"));
  const data = (await response.json()) as { tracker: TrackerItem | null };
  if (!data.tracker) throw new Error("记录项保存失败");
  return data.tracker;
}

export async function deleteTracker(id: number): Promise<void> {
  const response = await fetch(getApiUrl() + "/api/trackers?id=" + encodeURIComponent(String(id)), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await readError(response, "删除记录项失败"));
}

/** GET /api/trackers/logs?trackerId=xxx&limit=N → { logs } */
export async function fetchTrackerLogs(trackerId: number, limit = 30): Promise<TrackerLogItem[]> {
  const params = new URLSearchParams();
  params.set("trackerId", String(trackerId));
  params.set("limit", String(limit));
  const response = await fetch(getApiUrl() + "/api/trackers/logs?" + params.toString(), {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await readError(response, "记录加载失败"));
  const data = (await response.json()) as { logs: TrackerLogItem[] };
  return Array.isArray(data.logs) ? data.logs : [];
}

export interface TrackerLogUpsertInput {
  trackerId: number;
  logDate: string;
  value: number;
  note?: string;
}

/** POST /api/trackers/logs（同日期覆盖）→ { log } */
export async function upsertTrackerLog(input: TrackerLogUpsertInput): Promise<TrackerLogItem> {
  const response = await fetch(getApiUrl() + "/api/trackers/logs", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, "保存记录失败"));
  const data = (await response.json()) as { log: TrackerLogItem | null };
  if (!data.log) throw new Error("记录保存失败");
  return data.log;
}

/** 本地日期 → YYYY-MM-DD（本地时区） */
export function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}
