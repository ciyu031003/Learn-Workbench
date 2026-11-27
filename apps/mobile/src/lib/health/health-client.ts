import { getApiUrl } from "@/config";
import type { ActivityLevel } from "@learn-workbench/shared/labels";
import type { Sex } from "@learn-workbench/shared/types";
import type { EnergyPlan, HealthGoal, ReminderPrefs } from "@learn-workbench/shared/health-rules";
export interface HealthProfileDto {
  weightKg: number;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  bodyGoal: HealthGoal;
  trainingDaysPerWeek: number | null;
  sleepTargetMinutes: number;
  bedtimeTarget: string;
  reminderPrefs: ReminderPrefs;
}

export interface HealthProfileResponse {
  profile: HealthProfileDto;
  plan: EnergyPlan;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchHealthProfile(token: string | null): Promise<HealthProfileResponse> {
  const r = await fetch(`${getApiUrl()}/api/health/profile`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("加载健康目标失败");
  return (await r.json()) as HealthProfileResponse;
}

export async function saveHealthProfile(
  token: string | null,
  body: Partial<HealthProfileDto>
): Promise<HealthProfileResponse> {
  const r = await fetch(`${getApiUrl()}/api/health/profile`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("保存健康目标失败");
  return (await r.json()) as HealthProfileResponse;
}
