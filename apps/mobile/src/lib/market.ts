import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { enrollJobGaps } from "./jobs";
import type { MarketAnalysis, MarketGapItem, UserSkillView } from "@learn-workbench/shared";

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = useAppStore.getState().token;
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export async function fetchMarket(): Promise<MarketAnalysis> {
  const response = await fetch(getApiUrl() + "/api/market", {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "招聘市场数据加载失败"));
  }
  return (await response.json()) as MarketAnalysis;
}

export async function fetchMarketProfile(): Promise<{
  loggedIn: boolean;
  skills: UserSkillView[];
}> {
  const response = await fetch(getApiUrl() + "/api/profile/skills", {
    headers: authHeaders(),
  });
  if (response.status === 401) return { loggedIn: false, skills: [] };
  if (!response.ok) return { loggedIn: false, skills: [] };
  const data = await response.json().catch(() => null);
  return {
    loggedIn: true,
    skills: Array.isArray(data?.skills) ? (data.skills as UserSkillView[]) : [],
  };
}

export async function fetchMarketGaps(limit = 12): Promise<MarketGapItem[]> {
  const response = await fetch(
    getApiUrl() + `/api/skills/gaps?limit=${encodeURIComponent(String(limit))}`,
    { headers: authHeaders() }
  );
  if (response.status === 401) return [];
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data?.gaps) ? (data.gaps as MarketGapItem[]) : [];
}

export function enrollMarketGaps(gaps: MarketGapItem[]): Promise<number> {
  return enrollJobGaps(
    gaps.map((gap) => ({
      skill: gap.skill,
      topicId: gap.topicId,
      estimateHours: gap.estimateHours,
    }))
  );
}

export { marketKpis, marketSkillRows } from "./market-view";
export type { MarketKpis, MarketSkillRow } from "./market-view";
