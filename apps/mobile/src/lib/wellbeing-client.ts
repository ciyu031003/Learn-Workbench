import { getApiUrl } from "@/config";
import type { ActivityLevel, Sex } from "@learn-workbench/shared";

/** 打卡类接口的轻量客户端（v3 P3：饮水 / 体重 / 目标），全部走 Bearer 鉴权 */

export interface HydrationLog {
  id: number;
  amountMl: number;
  source: string;
  recordedAt: string;
}

export interface HydrationToday {
  logs: HydrationLog[];
  totalMl: number;
  targetMl: number;
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** 今日饮水（复用已有后端 /api/wellbeing/hydration） */
export async function fetchHydration(token: string | null, date?: string): Promise<HydrationToday> {
  const url = `${getApiUrl()}/api/wellbeing/hydration${date ? `?date=${date}` : ""}`;
  const r = await fetch(url, { headers: authHeaders(token) });
  if (!r.ok) throw new Error("加载饮水失败");
  const d = await r.json();
  return {
    logs: Array.isArray(d.logs) ? d.logs : [],
    totalMl: Number(d.totalMl) || 0,
    targetMl: Number(d.targetMl) || 2000,
  };
}

export async function addHydration(token: string | null, amountMl: number, source = "MANUAL"): Promise<void> {
  const r = await fetch(`${getApiUrl()}/api/wellbeing/hydration`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ amountMl, source }),
  });
  if (!r.ok) throw new Error("记录饮水失败");
}

export async function removeHydration(token: string | null, id: number): Promise<void> {
  const r = await fetch(`${getApiUrl()}/api/wellbeing/hydration?id=${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!r.ok) throw new Error("撤销失败");
}

export interface WeightPointDto {
  id: number;
  date: string;
  weightKg: number;
}

export async function fetchWeight(
  token: string | null,
  days = 30
): Promise<{ points: WeightPointDto[]; latest: WeightPointDto | null }> {
  const r = await fetch(`${getApiUrl()}/api/wellbeing/weight?days=${days}`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error("加载体重失败");
  const d = await r.json();
  return {
    points: Array.isArray(d.points) ? d.points : [],
    latest: d.latest ?? null,
  };
}

export async function addWeight(token: string | null, weightKg: number, date?: string): Promise<void> {
  const r = await fetch(`${getApiUrl()}/api/wellbeing/weight`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ weightKg, date }),
  });
  if (!r.ok) throw new Error("记录体重失败");
}

export interface NutritionTargetDto {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  computed: boolean;
  bmr: number | null;
  factor: number;
  note: string;
}

export interface NutritionProfileDto {
  weightKg: number;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
}

export async function fetchNutritionTarget(
  token: string | null
): Promise<{ profile: NutritionProfileDto; target: NutritionTargetDto }> {
  const r = await fetch(`${getApiUrl()}/api/nutrition/target`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error("加载目标失败");
  const d = await r.json();
  return { profile: d.profile, target: d.target };
}

export async function saveNutritionTarget(
  token: string | null,
  body: Partial<NutritionProfileDto> & { kcal?: number | null; proteinG?: number | null; carbsG?: number | null; fatG?: number | null }
): Promise<{ profile: NutritionProfileDto; target: NutritionTargetDto }> {
  const r = await fetch(`${getApiUrl()}/api/nutrition/target`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("保存目标失败");
  const d = await r.json();
  return { profile: d.profile, target: d.target };
}
