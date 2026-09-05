import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { RoadmapPhase } from "@learn-workbench/shared";

const CACHE_KEY = "lwb-roadmap-cache";

type RoadmapResponse = { phases: RoadmapPhase[] };

function authHeaders(): Record<string, string> {
  const token = useAppStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = authHeaders();
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(getApiUrl() + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!r.ok || !data) throw new Error((data as { error?: string } | null)?.error ?? "请求失败");
  return data;
}

/** 用服务端全量路线（含自定义阶段/主题 + 进度）覆盖本地缓存；离线时返回缓存。 */
export async function fetchRoadmap(): Promise<RoadmapPhase[]> {
  try {
    if (!useAppStore.getState().token) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached) as RoadmapPhase[];
      return [];
    }
    const data = await request<RoadmapResponse>("/api/roadmap?career=ict");
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data.phases ?? []));
    return data.phases ?? [];
  } catch {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? (JSON.parse(cached) as RoadmapPhase[]) : [];
  }
}

export async function readCachedRoadmap(): Promise<RoadmapPhase[]> {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  if (cached) return JSON.parse(cached) as RoadmapPhase[];
  return [];
}

export async function createPhase(title: string, summary: string | null, weeks: string | null): Promise<unknown> {
  return request("/api/roadmap/phases", {
    method: "POST",
    body: { career: "ict", track: "main", title, summary, weeks },
  });
}

export async function reorderPhases(order: number[]): Promise<unknown> {
  return request("/api/roadmap/reorder", {
    method: "POST",
    body: { career: "ict", track: "main", order },
  });
}
