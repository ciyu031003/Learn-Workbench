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

export type MarketIntelligenceRange = 7 | 30 | 90;

export interface MarketIntelligenceFilters {
  q?: string;
  city?: string;
  functionKey?: string;
  industrySector?: string;
  industrySubsector?: string;
  seniorityBucket?: string;
  source?: string;
  salaryMin?: number;
  salaryMax?: number;
  range?: MarketIntelligenceRange;
}

export interface MarketFacetItem {
  key: string;
  label: string;
  count: number;
}

export interface MarketRankItem {
  key: string;
  label: string;
  count: number;
  medianSalary: number | null;
  avgSalary?: number | null;
}

export interface MarketTimePoint {
  date: string;
  newJobs: number;
  medianSalary: number | null;
  avgSalary: number | null;
}

export interface MarketIntelligencePayload {
  generatedAt: string;
  filters: MarketIntelligenceFilters;
  summary: {
    total: number;
    cityCount: number;
    skillCount: number;
    avgSalary: number | null;
    medianSalary: number | null;
    last7DaysJobs: number;
  };
  facets: {
    cities: MarketFacetItem[];
    functions: MarketFacetItem[];
    industries: MarketFacetItem[];
    seniorities: MarketFacetItem[];
    sources: MarketFacetItem[];
  };
  distributions: {
    byCity: MarketRankItem[];
    byFunction: MarketRankItem[];
    byIndustry: Array<{ sector: string; subsector: string; count: number }>;
    bySeniority: MarketFacetItem[];
    bySalary: Array<{ label: string; count: number }>;
    bySkill: MarketRankItem[];
  };
  timeSeries: MarketTimePoint[];
}

export type MarketPersonalInsights =
  | { loggedIn: false }
  | {
      loggedIn: true;
      profile: {
        skills: UserSkillView[];
        profileSkillCount: number;
        marketSkillCount: number;
        skillCoveragePct: number;
      };
      reachableJobs: number;
      gaps: MarketGapItem[];
      recommendations: Array<{
        id: number;
        title: string;
        company: string;
        city: string;
        salaryText: string;
        url: string;
        source: string;
        isNew: boolean;
        isFav: boolean;
        match: number;
        matchedSkills: string[];
        missingSkills: string[];
      }>;
    };

export interface MarketDecisionMove {
  key: string;
  label: string;
  count: number;
  medianSalary: number | null;
  score: number;
  reason: string;
}

export interface MarketDecisionPayload {
  generatedAt: string;
  hotspots: MarketDecisionMove[];
  migrations: MarketDecisionMove[];
  alerts: MarketDecisionMove[];
  scenario: {
    city: string;
    functionKey: string;
    totalJobs: number;
    medianSalary: number | null;
    avgSalary: number | null;
    topSkills: string[];
    reachableJobs: number | null;
    missingSkills: string[];
    suggestions: string[];
  };
}

function marketQuery(filters: MarketIntelligenceFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.city) params.set("city", filters.city);
  if (filters.functionKey) params.set("function", filters.functionKey);
  if (filters.industrySector) params.set("industrySector", filters.industrySector);
  if (filters.industrySubsector) params.set("industrySubsector", filters.industrySubsector);
  if (filters.seniorityBucket) params.set("seniority", filters.seniorityBucket);
  if (filters.source) params.set("source", filters.source);
  if (filters.salaryMin != null) params.set("salaryMin", String(filters.salaryMin));
  if (filters.salaryMax != null) params.set("salaryMax", String(filters.salaryMax));
  if (filters.range && filters.range !== 90) params.set("range", String(filters.range));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchMarketIntelligence(
  filters: MarketIntelligenceFilters = {}
): Promise<MarketIntelligencePayload> {
  const response = await fetch(getApiUrl() + "/api/market/intelligence" + marketQuery(filters), {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "市场情报加载失败"));
  }
  return (await response.json()) as MarketIntelligencePayload;
}

export async function fetchMarketPersonal(): Promise<MarketPersonalInsights> {
  const response = await fetch(getApiUrl() + "/api/market/personal", {
    headers: authHeaders(),
  });
  if (!response.ok) return { loggedIn: false };
  return (await response.json()) as MarketPersonalInsights;
}

export async function fetchMarketDecision(
  city?: string,
  functionKey?: string
): Promise<MarketDecisionPayload> {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (functionKey) params.set("function", functionKey);
  const query = params.toString();
  const response = await fetch(
    getApiUrl() + "/api/market/decision" + (query ? `?${query}` : ""),
    { headers: authHeaders() }
  );
  if (!response.ok) {
    throw new Error(await readError(response, "市场决策加载失败"));
  }
  return (await response.json()) as MarketDecisionPayload;
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
