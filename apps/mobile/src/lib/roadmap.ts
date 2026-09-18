import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { RoadmapPhase } from "@learn-workbench/shared";

const CACHE_KEY = "lwb-roadmap-cache";
/**
 * 当前学习领域缓存（v6 P3-1）。
 * 之前 `fetchRoadmap` 把 `career=ict` 写死，用户切到别的领域（或跳过职业选择）后
 * 学习页仍然显示 ICT 内容 —— 这里改成「服务端 settings.career 为准 + 本地缓存兜底」。
 */
const CAREER_KEY = "lwb-active-career";

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

async function readCachedCareer(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(CAREER_KEY)) || "ict";
  } catch {
    return "ict";
  }
}

/** 当前学习领域：已登录时以服务端 settings.career 为准（并回写缓存），离线用缓存 */
export async function resolveCareer(): Promise<string> {
  const cached = await readCachedCareer();
  if (!useAppStore.getState().token) return cached;
  try {
    const r = await fetch(getApiUrl() + "/api/settings/career", { headers: authHeaders() });
    const d = (await r.json()) as { career?: unknown };
    const key = typeof d.career === "string" && d.career.trim() ? d.career.trim() : cached;
    await AsyncStorage.setItem(CAREER_KEY, key);
    return key;
  } catch {
    return cached;
  }
}

/** 领域切换成功后立刻写缓存（domain-manager 用，避免下次进学习页还读旧领域） */
export async function setCachedCareer(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CAREER_KEY, key);
  } catch {
    // 缓存失败不影响主流程
  }
}

/**
 * 拉取路线图。**返回 null 表示没拿到权威答案**（未登录且无缓存 / 网络或服务端出错），
 * 调用方据此决定「保留现有内容」而不是把页面清空；返回 `[]` 才是「这个领域确实没有阶段」。
 */
export async function fetchRoadmapOrNull(career?: string): Promise<RoadmapPhase[] | null> {
  const key = career ?? (await resolveCareer());
  const cacheKey = `${CACHE_KEY}:${key}`;
  if (!useAppStore.getState().token) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      return cached ? (JSON.parse(cached) as RoadmapPhase[]) : null;
    } catch {
      return null;
    }
  }
  try {
    const data = await request<RoadmapResponse>(`/api/roadmap?career=${encodeURIComponent(key)}`);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data.phases ?? []));
    return data.phases ?? [];
  } catch {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      return cached ? (JSON.parse(cached) as RoadmapPhase[]) : null;
    } catch {
      return null;
    }
  }
}

/** 用服务端全量路线（含自定义阶段/主题 + 进度）覆盖本地缓存；失败返回缓存或空数组 */
export async function fetchRoadmap(career?: string): Promise<RoadmapPhase[]> {
  return (await fetchRoadmapOrNull(career)) ?? [];
}

export async function readCachedRoadmap(career?: string): Promise<RoadmapPhase[]> {
  const key = career ?? (await readCachedCareer());
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_KEY}:${key}`);
    if (cached) return JSON.parse(cached) as RoadmapPhase[];
    // 兼容升级前的单一缓存键（第一次打开不至于空白）
    const legacy = await AsyncStorage.getItem(CACHE_KEY);
    return legacy ? (JSON.parse(legacy) as RoadmapPhase[]) : [];
  } catch {
    return [];
  }
}

export async function createPhase(
  title: string,
  summary: string | null,
  weeks: string | null,
  career?: string
): Promise<unknown> {
  return request("/api/roadmap/phases", {
    method: "POST",
    body: { career: career ?? (await resolveCareer()), track: "main", title, summary, weeks },
  });
}

export async function reorderPhases(order: number[], career?: string): Promise<unknown> {
  return request("/api/roadmap/reorder", {
    method: "POST",
    body: { career: career ?? (await resolveCareer()), track: "main", order },
  });
}

export async function deletePhase(id: number): Promise<unknown> {
  return request(`/api/roadmap/phases?id=${id}`, { method: "DELETE" });
}

export async function updatePhase(
  id: number,
  data: { title?: string; summary?: string | null; weeks?: string | null }
): Promise<unknown> {
  return request("/api/roadmap/phases", {
    method: "PATCH",
    body: { id, ...data },
  });
}

/* ------------------------- v6 P3-2：Markdown 导入 ------------------------- */

export interface MdImportItemPreview { title: string; contentMd: string }
export interface MdImportTopicPreview { title: string; summary: string | null; items: MdImportItemPreview[] }
export interface MdImportPhasePreview { title: string; summary: string | null; topics: MdImportTopicPreview[] }

export interface MdImportResult {
  ok: boolean;
  dryRun?: boolean;
  career?: string;
  batchId?: string;
  preview?: MdImportPhasePreview[];
  counts?: { phases: number; topics: number; items: number };
  created?: { phases: number; topics: number; items: number };
}

/** 导入 Markdown 学习计划（dryRun=true 只解析返回预览树，不写库） */
export async function importRoadmapMarkdown(
  markdown: string,
  opts: { career?: string; dryRun?: boolean } = {}
): Promise<MdImportResult> {
  return request<MdImportResult>("/api/roadmap/import", {
    method: "POST",
    body: { markdown, ...opts },
  });
}
