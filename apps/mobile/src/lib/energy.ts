import { getApiUrl } from "@/config";
import { isValidEnergyLevel } from "@/lib/energy-levels";

export { ENERGY_LEVELS, energyLevelOf, isValidEnergyLevel } from "@/lib/energy-levels";
export type { EnergyLevel } from "@/lib/energy-levels";

/** 每天精力状态（energy_logs，接口早已存在：GET/POST /api/wellbeing/energy） */

function headers(token: string | null): Record<string, string> {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** 最近一次精力记录（没有就返回 null） */
export async function fetchLatestEnergy(token: string | null): Promise<{ level: number; recordedAt: string } | null> {
  const r = await fetch(`${getApiUrl()}/api/wellbeing/energy?limit=1`, { headers: headers(token) });
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  const row = data?.logs?.[0];
  if (!row || !isValidEnergyLevel(Number(row.level))) return null;
  return { level: Number(row.level), recordedAt: String(row.recordedAt ?? "") };
}

/** 记录一次精力状态 */
export async function logEnergy(
  token: string | null,
  level: number,
  source: "MANUAL" | "AFTER_FOCUS" | "MORNING" = "MANUAL"
): Promise<void> {
  if (!isValidEnergyLevel(level)) throw new Error("精力等级需在 1-5 之间");
  const r = await fetch(`${getApiUrl()}/api/wellbeing/energy`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ level, source }),
  });
  if (!r.ok) throw new Error("精力记录失败");
}
