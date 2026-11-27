/**
 * 健康规则引擎（纯函数，Web / Mobile 共用）。
 *
 * 设计原则：
 *  1. 不猜：数据不足时明确返回 insufficient，不给建议也不发提醒；
 *  2. 可解释：每个目标 / 评分 / 提醒都带 evidence 与 confidence；
 *  3. 不做医疗诊断：只输出生活方式建议，措辞保持中性；
 *  4. 公式可追溯：BMR 用 Mifflin-St Jeor，TDEE = BMR × 活动系数，
 *     宏量营养按 g/kg 与热量占比共同约束；睡眠按 AASM/NSF 常用参考区间做启发式评分。
 *
 * 参考口径（公开指南 / 常用公式，不替代医生建议）：
 *  - Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990（BMR）
 *  - WHO / FAO 能量需求与身体活动水平（PAL）分层
 *  - ISSN Position Stand: protein and exercise（1.4–2.0 g/kg/d）
 *  - AASM / Sleep Health Journal：成人 7–9 小时睡眠、规律作息
 *  - 睡眠效率、深睡 / REM 占比采用常见消费级设备参考区间
 */

import type { ActivityLevel } from "./labels";
import { ACTIVITY_FACTORS, DEFAULT_NUTRITION_TARGETS } from "./labels";

export const HEALTH_RULES_VERSION = "2026.11";
export const DEFAULT_SLEEP_TARGET_MIN = 450;
export const DEFAULT_BEDTIME_TARGET = "23:30";
export const DEFAULT_PROTEIN_FLOOR_RATIO = 0.8;

export type HealthGoal = "lose" | "maintain" | "gain";
export type HealthConfidence = "insufficient" | "early" | "moderate" | "stable";
export type HealthTone = "green" | "amber" | "orange" | "red" | "blue" | "lilac";

export interface HealthProfileInput {
  weightKg: number;
  heightCm?: number | null;
  birthYear?: number | null;
  sex?: "male" | "female" | null;
  activityLevel?: ActivityLevel | null;
  bodyGoal?: HealthGoal | null;
  trainingDaysPerWeek?: number | null;
}

export interface EnergyPlan {
  bmr: number | null;
  tdee: number | null;
  age: number | null;
  activityFactor: number;
  goal: HealthGoal;
  goalDeltaPct: number;
  kcal: number;
  kcalFloor: number;
  floorApplied: boolean;
  proteinG: number;
  proteinPerKg: number;
  fatG: number;
  fatPctOfKcal: number;
  carbsG: number;
  computed: boolean;
  confidence: "low" | "medium" | "high";
  notes: string[];
  formula: string;
}

export interface NutritionDaySample {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryCount: number;
}

export interface NutritionBaseline {
  windowDays: number;
  recordedDays: number;
  totalEntries: number;
  validDays: number;
  avgKcal: number | null;
  avgProteinG: number | null;
  avgCarbsG: number | null;
  avgFatG: number | null;
  coverage: number;
  minDays: number;
  minEntries: number;
  meetsMinimum: boolean;
  confidence: HealthConfidence;
  note: string;
}

export interface SleepNightSample {
  date: string;
  durationMin: number;
  efficiencyPct?: number | null;
  deepPct?: number | null;
  remPct?: number | null;
  awakeCount?: number | null;
  bedtimeOffsetMin?: number | null;
}

export interface SleepComponent {
  key: "duration" | "efficiency" | "stages" | "regularity" | "debt" | "awake";
  label: string;
  score: number;
  weightPct: number;
  valueText: string;
  available: boolean;
}

export interface SleepAssessment {
  windowDays: number;
  nights: number;
  nightsWithStages: number;
  meetsMinimum: boolean;
  confidence: HealthConfidence;
  score: number | null;
  components: SleepComponent[];
  avgDurationMin: number | null;
  avgEfficiencyPct: number | null;
  avgDeepPct: number | null;
  avgRemPct: number | null;
  avgAwakeCount: number | null;
  bedtimeStdMin: number | null;
  avgBedtimeOffsetMin: number | null;
  debtMin: number | null;
  regularityLabel: string;
  flags: {
    shortSleep: boolean;
    lateBedtime: boolean;
    irregular: boolean;
    lowEfficiency: boolean;
    lowDeep: boolean;
    highAwake: boolean;
  };
  note: string;
}

export type HealthInsightKind = "observation" | "suggestion" | "reminder";

export interface HealthInsight {
  key: string;
  kind: HealthInsightKind;
  tone: HealthTone;
  title: string;
  body: string;
  evidence: string;
  confidence: HealthConfidence;
  priority: number;
}

export interface ReminderPrefs {
  earlySleep?: boolean;
  protein?: boolean;
  quietStart?: string;
  quietEnd?: string;
}

export interface HealthReminderCandidate {
  key: "early-sleep" | "protein";
  title: string;
  body: string;
  hour: number;
  minute: number;
  windowLabel: string;
  confidence: HealthConfidence;
  evidence: string;
  active: boolean;
}

export interface HealthBriefing {
  insights: HealthInsight[];
  reminders: HealthReminderCandidate[];
  nutrition7: NutritionBaseline;
  nutrition28: NutritionBaseline;
  sleep7: SleepAssessment;
  sleep28: SleepAssessment;
}

/* ------------------------------------------------------------------ */
/* 基础工具                                                           */
/* ------------------------------------------------------------------ */

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function mean(values: readonly number[]): number | null {
  const safe = values.filter((value) => finite(value));
  if (safe.length === 0) return null;
  return safe.reduce((sum, value) => sum + value, 0) / safe.length;
}

function std(values: readonly number[]): number | null {
  const safe = values.filter((value) => finite(value));
  if (safe.length < 2) return null;
  const avg = safe.reduce((sum, value) => sum + value, 0) / safe.length;
  return Math.sqrt(safe.reduce((sum, value) => sum + (value - avg) ** 2, 0) / safe.length);
}

function shiftDateKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + deltaDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function lastDateKey(samples: readonly { date: string }[]): string | null {
  let max: string | null = null;
  for (const sample of samples) {
    const key = typeof sample?.date === "string" ? sample.date.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (max === null || key > max) max = key;
  }
  return max;
}

/** HH:mm -> 相对 24:00 的偏移（23:30 = -30，00:30 = +30）；非法返回 null */
export function clockToBedtimeOffset(clock: string | null | undefined): number | null {
  if (typeof clock !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const minutes = hour * 60 + minute;
  return minutes >= 12 * 60 ? minutes - 24 * 60 : minutes;
}

/** 相对 24:00 的偏移 -> HH:mm */
export function bedtimeOffsetToClock(offset: number | null | undefined): string | null {
  if (!finite(offset)) return null;
  const raw = ((Math.round(offset) % 1440) + 1440) % 1440;
  return `${String(Math.floor(raw / 60)).padStart(2, "0")}:${String(raw % 60).padStart(2, "0")}`;
}

/** 分钟 -> HH:mm */
export function minutesToClock(totalMinutes: number): string {
  const raw = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(raw / 60)).padStart(2, "0")}:${String(raw % 60).padStart(2, "0")}`;
}

/** 静默时段是否包含某时刻（支持跨零点，例如 23:00–07:00） */
export function inQuietHours(hour: number, minute: number, quietStart?: string, quietEnd?: string): boolean {
  const start = typeof quietStart === "string" ? quietStart : "";
  const end = typeof quietEnd === "string" ? quietEnd : "";
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start === end) return false;
  const now = hour * 60 + minute;
  const s = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const e = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  if (s < e) return now >= s && now < e;
  return now >= s || now < e;
}

export function healthConfidenceLabel(confidence: HealthConfidence): string {
  if (confidence === "stable") return "稳定基线";
  if (confidence === "moderate") return "四周基线";
  if (confidence === "early") return "一周基线";
  return "数据积累中";
}

/* ------------------------------------------------------------------ */
/* 1. 每日能量与宏量营养                                              */
/* ------------------------------------------------------------------ */

/**
 * 个体化能量计划。
 *
 * BMR：Mifflin-St Jeor
 *   male   = 10w + 6.25h - 5a + 5
 *   female = 10w + 6.25h - 5a - 161
 * TDEE = BMR × PAL（久坐 1.2 / 轻活动 1.375 / 中等 1.55 / 高 1.725）
 * 目标：减脂 -15%、维持 0、增肌 +8%；再套安全下限（女 1200 / 男 1500 kcal）。
 *
 * 蛋白质：按目标 + 训练频率取 1.2–2.2 g/kg（ISSN 运动营养立场）。
 * 脂肪：目标热量 25%，且不低于 0.6 g/kg；碳水补足剩余热量。
 */
export function buildEnergyPlan(profile: HealthProfileInput, now: Date = new Date()): EnergyPlan {
  const weightKg = finite(profile.weightKg) && profile.weightKg > 0 ? profile.weightKg : 60;
  const heightCm = finite(profile.heightCm) && profile.heightCm > 0 ? profile.heightCm : null;
  const birthYear = finite(profile.birthYear) && profile.birthYear > 1900 ? profile.birthYear : null;
  const sex = profile.sex === "male" || profile.sex === "female" ? profile.sex : null;
  const age = birthYear !== null ? clamp(now.getFullYear() - birthYear, 14, 90) : null;
  const activityLevel: ActivityLevel = profile.activityLevel ?? "light";
  const activityFactor = ACTIVITY_FACTORS[activityLevel] ?? 1.375;
  const goal: HealthGoal = profile.bodyGoal === "lose" || profile.bodyGoal === "gain" ? profile.bodyGoal : "maintain";
  const trainingDays = finite(profile.trainingDaysPerWeek)
    ? clamp(Math.round(profile.trainingDaysPerWeek), 0, 7)
    : null;

  let bmr: number | null = null;
  if (heightCm !== null && age !== null && sex !== null) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
    bmr = Math.round(base);
  }

  const tdee = bmr !== null ? Math.round(bmr * activityFactor) : null;
  const baseKcal = tdee ?? DEFAULT_NUTRITION_TARGETS.kcal;
  const goalDeltaPct = goal === "lose" ? -15 : goal === "gain" ? 8 : 0;
  const kcalFloor = sex === "female" ? 1200 : sex === "male" ? 1500 : 1200;
  const rawKcal = Math.round(baseKcal * (1 + goalDeltaPct / 100));
  const kcal = Math.round(clamp(rawKcal, kcalFloor, 6000));
  const floorApplied = kcal > rawKcal;

  const goalProteinPerKg = goal === "lose" ? 1.8 : goal === "gain" ? 1.6 : 1.4;
  const trainingBoost = trainingDays !== null && trainingDays >= 3 ? 0.2 : 0;
  const proteinPerKg = clamp(goalProteinPerKg + trainingBoost, 1.2, 2.2);
  const proteinG = Math.round(weightKg * proteinPerKg);

  const proteinKcal = proteinG * 4;
  const minCarbKcal = 50 * 4;
  const preferredFatKcal = kcal * 0.25;
  const minFatKcal = weightKg * 0.6 * 9;
  const maxFatKcal = Math.max(minFatKcal, kcal - proteinKcal - minCarbKcal);
  const fatKcal = clamp(preferredFatKcal, minFatKcal, maxFatKcal);
  const fatG = Math.max(1, Math.round(fatKcal / 9));
  const carbsG = Math.max(50, Math.round((kcal - proteinKcal - fatG * 9) / 4));

  const notes: string[] = [];
  if (bmr !== null) {
    notes.push(`Mifflin-St Jeor：BMR ${bmr} kcal，按${activityLevel}活动水平 ×${activityFactor} 得 TDEE ${tdee} kcal。`);
  } else {
    notes.push(`缺少身高 / 出生年 / 性别，暂用默认 ${DEFAULT_NUTRITION_TARGETS.kcal} kcal；补齐后会自动重算。`);
  }
  if (goalDeltaPct !== 0) {
    notes.push(`${goal === "lose" ? "减脂" : "增肌"}目标在 TDEE 上${goalDeltaPct > 0 ? "增加" : "减少"} ${Math.abs(goalDeltaPct)}%。`);
  }
  if (floorApplied) {
    notes.push(`已应用 ${kcalFloor} kcal 安全下限，避免目标过低。`);
  }
  notes.push(`蛋白质按 ${proteinPerKg.toFixed(1)} g/kg 估算；脂肪不低于 0.6 g/kg，碳水补足剩余热量。`);

  const knownFields = [heightCm !== null, birthYear !== null, sex !== null].filter(Boolean).length;
  const confidence = knownFields === 3 ? "high" : knownFields >= 1 ? "medium" : "low";

  return {
    bmr,
    tdee,
    age,
    activityFactor,
    goal,
    goalDeltaPct,
    kcal,
    kcalFloor,
    floorApplied,
    proteinG,
    proteinPerKg: Math.round(proteinPerKg * 100) / 100,
    fatG,
    fatPctOfKcal: kcal > 0 ? Math.round(((fatG * 9) / kcal) * 1000) / 10 : 0,
    carbsG,
    computed: bmr !== null,
    confidence,
    notes,
    formula: "Mifflin-St Jeor 1990 · PAL 分层",
  };
}

/* ------------------------------------------------------------------ */
/* 2. 7 / 28 天营养基线                                               */
/* ------------------------------------------------------------------ */

const NUTRITION_GATE: Record<number, { minDays: number; minEntries: number }> = {
  7: { minDays: 5, minEntries: 14 },
  28: { minDays: 18, minEntries: 50 },
};

/**
 * 滚动营养基线。
 *
 * 只统计有记录的天：entryCount >= 2 才算有效日，避免把漏记误判成断食。
 * 7 天门槛：>=5 天且 >=14 条；28 天门槛：>=18 天且 >=50 条。
 */
export function buildNutritionBaseline(
  samples: readonly NutritionDaySample[],
  options: { windowDays?: number; endDate?: string | null } = {}
): NutritionBaseline {
  const windowDays = options.windowDays === 28 ? 28 : 7;
  const gate = NUTRITION_GATE[windowDays];
  const endDate = options.endDate ?? lastDateKey(samples);
  const startDate = endDate ? shiftDateKey(endDate, -(windowDays - 1)) : null;

  const scoped: NutritionDaySample[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(samples) ? samples : []) {
    const date = typeof raw?.date === "string" ? raw.date.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) continue;
    if (startDate && (date < startDate || (endDate && date > endDate))) continue;
    seen.add(date);
    if (!finite(raw.entryCount) || raw.entryCount < 2) continue;
    if (!finite(raw.kcal) || raw.kcal <= 0) continue;
    scoped.push({
      date,
      kcal: raw.kcal,
      proteinG: finite(raw.proteinG) ? raw.proteinG : 0,
      carbsG: finite(raw.carbsG) ? raw.carbsG : 0,
      fatG: finite(raw.fatG) ? raw.fatG : 0,
      entryCount: raw.entryCount,
    });
  }

  const validDays = scoped.length;
  const totalEntries = scoped.reduce((sum, day) => sum + day.entryCount, 0);
  const avgKcal = mean(scoped.map((day) => day.kcal));
  const avgProteinG = mean(scoped.map((day) => day.proteinG));
  const avgCarbsG = mean(scoped.map((day) => day.carbsG));
  const avgFatG = mean(scoped.map((day) => day.fatG));
  const meetsMinimum = validDays >= gate.minDays && totalEntries >= gate.minEntries;

  let confidence: HealthConfidence = "insufficient";
  if (windowDays === 7) {
    confidence = meetsMinimum ? "early" : "insufficient";
  } else if (meetsMinimum) {
    confidence = validDays >= 24 && totalEntries >= 60 ? "stable" : "moderate";
  }

  const missingDays = Math.max(0, gate.minDays - validDays);
  const missingEntries = Math.max(0, gate.minEntries - totalEntries);
  const note = meetsMinimum
    ? `近 ${windowDays} 天有 ${validDays} 天记录，共 ${totalEntries} 条，可形成${windowDays === 7 ? "一周" : "四周"}基线。`
    : `近 ${windowDays} 天有 ${validDays}/${gate.minDays} 天、${totalEntries}/${gate.minEntries} 条记录，还差 ${missingDays} 天${missingEntries > 0 ? ` / ${missingEntries} 条` : ""}。`;

  return {
    windowDays,
    recordedDays: validDays,
    totalEntries,
    validDays,
    avgKcal: avgKcal === null ? null : round(avgKcal),
    avgProteinG: avgProteinG === null ? null : round(avgProteinG),
    avgCarbsG: avgCarbsG === null ? null : round(avgCarbsG),
    avgFatG: avgFatG === null ? null : round(avgFatG),
    coverage: windowDays > 0 ? Math.min(1, validDays / windowDays) : 0,
    minDays: gate.minDays,
    minEntries: gate.minEntries,
    meetsMinimum,
    confidence,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* 3. 睡眠综合判定                                                    */
/* ------------------------------------------------------------------ */

function durationComponent(avgMinutes: number, targetMin: number): number {
  if (avgMinutes >= targetMin && avgMinutes <= targetMin + 90) return 100;
  if (avgMinutes < targetMin) return clamp(100 - (targetMin - avgMinutes) / 3, 0, 100);
  return clamp(100 - (avgMinutes - (targetMin + 90)) / 3, 0, 100);
}

function efficiencyComponent(value: number | null): number | null {
  if (!finite(value)) return null;
  return clamp(((value - 60) / 35) * 100, 0, 100);
}

function stagesComponent(deep: number | null, rem: number | null): number | null {
  const parts: number[] = [];
  if (finite(deep)) parts.push(clamp(100 - Math.abs(deep - 17.5) * 5, 0, 100));
  if (finite(rem)) parts.push(clamp(100 - Math.abs(rem - 22.5) * 4, 0, 100));
  return parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) / parts.length : null;
}

function regularityComponent(value: number | null): number | null {
  if (!finite(value)) return null;
  if (value <= 30) return 100;
  if (value <= 60) return clamp(100 - (value - 30) * 1.5, 55, 100);
  return clamp(55 - (value - 60) * 0.6, 0, 55);
}

function awakeComponent(value: number | null): number | null {
  if (!finite(value)) return null;
  if (value <= 1) return 100;
  if (value <= 2) return 85;
  if (value <= 3) return 70;
  return clamp(70 - (value - 3) * 15, 0, 70);
}

function debtComponent(debt: number | null): number | null {
  if (!finite(debt)) return null;
  return clamp(100 - debt / 6, 0, 100);
}

function sleepConfidence(windowDays: number, nights: number): HealthConfidence {
  if (windowDays === 28) {
    if (nights >= 24) return "stable";
    if (nights >= 18) return "moderate";
    return nights >= 5 ? "early" : "insufficient";
  }
  return nights >= 5 ? "early" : "insufficient";
}

/**
 * 睡眠综合评估（0–100）。
 *
 * 权重：时长 30 / 效率 20 / 分期 15 / 规律 15 / 睡眠债 10 / 夜醒 10。
 * 缺项时分母只算可用项，绝不把缺失指标当成 0 或满分。
 * 少于 5 晚不给综合分（避免一晚定生死）。
 */
export function buildSleepAssessment(
  nights: readonly SleepNightSample[],
  options: { windowDays?: number; endDate?: string | null; targetMin?: number; bedtimeTarget?: string } = {}
): SleepAssessment {
  const windowDays = options.windowDays === 28 ? 28 : 7;
  const targetMin = finite(options.targetMin) ? clamp(options.targetMin, 300, 720) : DEFAULT_SLEEP_TARGET_MIN;
  const endDate = options.endDate ?? lastDateKey(nights);
  const startDate = endDate ? shiftDateKey(endDate, -(windowDays - 1)) : null;

  const scoped: SleepNightSample[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(nights) ? nights : []) {
    const date = typeof raw?.date === "string" ? raw.date.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) continue;
    if (startDate && (date < startDate || (endDate && date > endDate))) continue;
    seen.add(date);
    if (!finite(raw.durationMin) || raw.durationMin < 120 || raw.durationMin > 20 * 60) continue;
    scoped.push(raw);
  }

  const count = scoped.length;
  const nightsWithStages = scoped.filter((night) => finite(night.deepPct) || finite(night.remPct)).length;
  const minNights = windowDays === 28 ? 18 : 5;
  const meetsMinimum = count >= minNights;
  const confidence = sleepConfidence(windowDays, count);

  const avgDurationRaw = mean(scoped.map((night) => night.durationMin));
  const avgEfficiencyRaw = mean(scoped.map((night) => (finite(night.efficiencyPct) ? night.efficiencyPct : NaN)));
  const avgDeepRaw = mean(scoped.map((night) => (finite(night.deepPct) ? night.deepPct : NaN)));
  const avgRemRaw = mean(scoped.map((night) => (finite(night.remPct) ? night.remPct : NaN)));
  const avgAwakeRaw = mean(scoped.map((night) => (finite(night.awakeCount) ? night.awakeCount : NaN)));
  const bedtimeStdRaw = std(scoped.map((night) => (finite(night.bedtimeOffsetMin) ? night.bedtimeOffsetMin : NaN)));
  const avgBedtimeRaw = mean(scoped.map((night) => (finite(night.bedtimeOffsetMin) ? night.bedtimeOffsetMin : NaN)));

  const avgDurationMin = avgDurationRaw === null ? null : round(avgDurationRaw);
  const avgEfficiencyPct = avgEfficiencyRaw === null ? null : Math.round(avgEfficiencyRaw * 10) / 10;
  const avgDeepPct = avgDeepRaw === null ? null : Math.round(avgDeepRaw * 10) / 10;
  const avgRemPct = avgRemRaw === null ? null : Math.round(avgRemRaw * 10) / 10;
  const avgAwakeCount = avgAwakeRaw === null ? null : Math.round(avgAwakeRaw * 10) / 10;
  const bedtimeStdMin = bedtimeStdRaw === null ? null : round(bedtimeStdRaw);
  const avgBedtimeOffsetMin = avgBedtimeRaw === null ? null : round(avgBedtimeRaw);
  const debtMin =
    avgDurationMin === null ? null : Math.max(0, Math.round((targetMin - avgDurationMin) * Math.max(1, count)));

  const duration = avgDurationMin === null ? null : durationComponent(avgDurationMin, targetMin);
  const efficiency = efficiencyComponent(avgEfficiencyPct);
  const stages = stagesComponent(avgDeepPct, avgRemPct);
  const regularity = regularityComponent(bedtimeStdMin);
  const debt = debtComponent(debtMin);
  const awake = awakeComponent(avgAwakeCount);

  const rawComponents: { key: SleepComponent["key"]; label: string; score: number | null; weight: number; valueText: string }[] = [
    { key: "duration", label: "睡眠时长", score: duration, weight: 30, valueText: avgDurationMin === null ? "—" : `${Math.floor(avgDurationMin / 60)}h${String(avgDurationMin % 60).padStart(2, "0")}m` },
    { key: "efficiency", label: "睡眠效率", score: efficiency, weight: 20, valueText: avgEfficiencyPct === null ? "—" : `${Math.round(avgEfficiencyPct)}%` },
    { key: "stages", label: "深睡 / REM", score: stages, weight: 15, valueText: avgDeepPct === null && avgRemPct === null ? "—" : `深 ${avgDeepPct ?? "—"}% · REM ${avgRemPct ?? "—"}%` },
    { key: "regularity", label: "入睡规律", score: regularity, weight: 15, valueText: bedtimeStdMin === null ? "—" : `± ${bedtimeStdMin} 分` },
    { key: "debt", label: "睡眠债", score: debt, weight: 10, valueText: debtMin === null ? "—" : `${Math.floor(debtMin / 60)}h${String(debtMin % 60).padStart(2, "0")}m` },
    { key: "awake", label: "夜醒", score: awake, weight: 10, valueText: avgAwakeCount === null ? "—" : `${avgAwakeCount} 次/晚` },
  ];

  const available = rawComponents.filter((item) => item.score !== null);
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const components: SleepComponent[] = rawComponents.map((item) => ({
    key: item.key,
    label: item.label,
    score: item.score === null ? 0 : Math.round(item.score),
    weightPct: item.score === null || totalWeight <= 0 ? 0 : Math.round((item.weight / totalWeight) * 100),
    valueText: item.valueText,
    available: item.score !== null,
  }));

  const weighted =
    totalWeight > 0
      ? available.reduce((sum, item) => sum + (item.score as number) * item.weight, 0) / totalWeight
      : null;
  const score = meetsMinimum && weighted !== null ? Math.round(clamp(weighted, 0, 100)) : null;

  const bedtimeTargetOffset = clockToBedtimeOffset(options.bedtimeTarget ?? DEFAULT_BEDTIME_TARGET) ?? -30;
  const flags = {
    shortSleep: avgDurationMin !== null && avgDurationMin < 420,
    lateBedtime: avgBedtimeOffsetMin !== null && avgBedtimeOffsetMin > bedtimeTargetOffset + 30,
    irregular: bedtimeStdMin !== null && bedtimeStdMin > 45,
    lowEfficiency: avgEfficiencyPct !== null && avgEfficiencyPct < 85 && scoped.filter((n) => finite(n.efficiencyPct)).length >= 4,
    lowDeep: avgDeepPct !== null && avgDeepPct < 15 && scoped.filter((n) => finite(n.deepPct)).length >= 4,
    highAwake: avgAwakeCount !== null && avgAwakeCount >= 2,
  };

  const regularityLabel =
    bedtimeStdMin === null ? "记录不足" : bedtimeStdMin <= 30 ? "规律" : bedtimeStdMin <= 60 ? "一般" : "不规律";

  const note =
    score === null
      ? `近 ${windowDays} 天已记录 ${count} 晚，至少需要 ${minNights} 晚才给综合判定。`
      : `近 ${windowDays} 天 ${count} 晚综合分 ${score}，${regularityLabel}，睡眠债 ${debtMin === null ? "—" : `${debtMin} 分钟`}。`;

  return {
    windowDays,
    nights: count,
    nightsWithStages,
    meetsMinimum,
    confidence,
    score,
    components,
    avgDurationMin,
    avgEfficiencyPct,
    avgDeepPct,
    avgRemPct,
    avgAwakeCount,
    bedtimeStdMin,
    avgBedtimeOffsetMin,
    debtMin,
    regularityLabel,
    flags,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* 4. 洞察与提醒候选                                                  */
/* ------------------------------------------------------------------ */

function pctText(value: number | null, target: number): string {
  if (value === null || !finite(target) || target <= 0) return "—";
  return `${Math.round((value / target) * 100)}%`;
}

/**
 * 生成健康洞察与提醒候选。
 *
 * 关键门槛：
 *  - 营养：近 7 天 >=5 个有效日且 >=14 条，才谈平均蛋白 / 热量；
 *  - 睡眠：近 7 天 >=5 晚，才谈睡眠质量 / 早睡；
 *  - 单日不足、记录太少时只给继续记录，不主动提醒。
 */
export function buildHealthBriefing(input: {
  plan: EnergyPlan;
  nutrition7: NutritionBaseline;
  nutrition28: NutritionBaseline;
  sleep7: SleepAssessment;
  sleep28: SleepAssessment;
  sleepTargetMin?: number;
  bedtimeTarget?: string;
  trainingDaysPerWeek?: number | null;
  workoutDays7?: number | null;
}): HealthBriefing {
  const {
    plan,
    nutrition7,
    nutrition28,
    sleep7,
    sleep28,
    trainingDaysPerWeek = null,
    workoutDays7 = null,
  } = input;
  const sleepTargetMin = finite(input.sleepTargetMin) ? clamp(input.sleepTargetMin, 300, 720) : DEFAULT_SLEEP_TARGET_MIN;
  const bedtimeTargetOffset = clockToBedtimeOffset(input.bedtimeTarget ?? DEFAULT_BEDTIME_TARGET) ?? -30;
  const insights: HealthInsight[] = [];

  /* ---------- 营养 ---------- */
  // 口径统一：四周达标优先用四周基线（更稳），否则退回 7 天。
  // 判定与展示必须用同一个 reference，否则会出现「判定偏低、展示达标」的自相矛盾。
  const nutritionRef = nutrition28.meetsMinimum ? nutrition28 : nutrition7.meetsMinimum ? nutrition7 : null;
  if (!nutritionRef) {
    insights.push({
      key: "nutrition-collecting",
      kind: "observation",
      tone: "blue",
      title: "饮食基线还在积累",
      body: `近 7 天 ${nutrition7.validDays}/5 天、四周 ${nutrition28.validDays}/18 天有效记录。达到任一门槛后，系统才会判断蛋白质与热量是否长期偏离目标。`,
      evidence: `7 天 ${nutrition7.validDays}/5 · 28 天 ${nutrition28.validDays}/18`,
      confidence: "insufficient",
      priority: 8,
    });
  } else {
    const targetProtein = plan.proteinG;
    const reference = nutritionRef;
    const refProtein = reference.avgProteinG ?? 0;
    const refKcal = reference.avgKcal ?? 0;
    const proteinRatio = targetProtein > 0 ? refProtein / targetProtein : 1;
    const kcalRatio = plan.kcal > 0 ? refKcal / plan.kcal : 1;
    const refLabel = reference.windowDays === 28 ? "近四周" : "近 7 天";

    if (proteinRatio < DEFAULT_PROTEIN_FLOOR_RATIO) {
      insights.push({
        key: "protein-low",
        kind: "reminder",
        tone: proteinRatio < 0.6 ? "orange" : "amber",
        title: "蛋白质长期偏低",
        body: `${refLabel}平均 ${Math.round(refProtein)}g，目标 ${targetProtein}g（完成 ${pctText(refProtein, targetProtein)}）。每餐加一份鸡蛋、牛奶、豆制品或鸡胸，比晚上一次补更稳。`,
        evidence: `${reference.note} 判定线：低于目标 80%`,
        confidence: reference.confidence,
        priority: proteinRatio < 0.6 ? 1 : 2,
      });
    } else if (proteinRatio < 0.95) {
      insights.push({
        key: "protein-near",
        kind: "observation",
        tone: "amber",
        title: "蛋白质接近目标",
        body: `${refLabel}平均 ${Math.round(refProtein)}g / ${targetProtein}g。再补一份酸奶或豆制品就能进区间。`,
        evidence: reference.note,
        confidence: reference.confidence,
        priority: 5,
      });
    } else {
      insights.push({
        key: "protein-ok",
        kind: "observation",
        tone: "green",
        title: "蛋白质达标",
        body: `${refLabel}平均 ${Math.round(refProtein)}g，达到目标 ${targetProtein}g 的 ${pctText(refProtein, targetProtein)}。`,
        evidence: reference.note,
        confidence: reference.confidence,
        priority: 7,
      });
    }

    if (kcalRatio < 0.85) {
      insights.push({
        key: "kcal-low",
        kind: "suggestion",
        tone: "amber",
        title: "热量长期低于目标",
        body: `${refLabel}平均 ${Math.round(refKcal)} kcal，仅为目标 ${plan.kcal} kcal 的 ${pctText(refKcal, plan.kcal)}。如果正在减脂，建议把缺口控制在 10–20%，并优先保证蛋白与主食。`,
        evidence: reference.note,
        confidence: reference.confidence,
        priority: 3,
      });
    } else if (kcalRatio > 1.15) {
      insights.push({
        key: "kcal-high",
        kind: "suggestion",
        tone: "amber",
        title: "热量长期高于目标",
        body: `${refLabel}平均 ${Math.round(refKcal)} kcal，高于目标 ${plan.kcal} kcal 的 ${pctText(refKcal, plan.kcal)}。先从饮料、零食和外卖酱汁里找最容易减的一项。`,
        evidence: reference.note,
        confidence: reference.confidence,
        priority: 3,
      });
    } else {
      insights.push({
        key: "kcal-ok",
        kind: "observation",
        tone: "green",
        title: "热量处在目标区间",
        body: `${refLabel}平均 ${Math.round(refKcal)} kcal，目标 ${plan.kcal} kcal，偏差在 ±15% 内。`,
        evidence: reference.note,
        confidence: reference.confidence,
        priority: 7,
      });
    }
  }

  /* ---------- 睡眠 ---------- */
  const sleepRef = sleep7.meetsMinimum ? sleep7 : sleep28.meetsMinimum ? sleep28 : null;
  if (!sleepRef) {
    insights.push({
      key: "sleep-collecting",
      kind: "observation",
      tone: "lilac",
      title: "睡眠基线还在积累",
      body: `近 7 天 ${sleep7.nights}/5 晚、四周 ${sleep28.nights}/18 晚。近 7 天满 5 晚或四周满 18 晚后，系统才会判断时长、规律性与睡眠债。`,
      evidence: `7 天 ${sleep7.nights}/5 · 28 天 ${sleep28.nights}/18`,
      confidence: "insufficient",
      priority: 8,
    });
  } else {
    const stable = sleep28.meetsMinimum;
    const reference = stable ? sleep28 : sleep7;
    const refLabel = stable ? "近四周" : "近 7 天";
    const late =
      reference.avgBedtimeOffsetMin !== null &&
      reference.avgBedtimeOffsetMin > bedtimeTargetOffset + 30;
    const debtHigh = (reference.debtMin ?? 0) >= 180;
    const short = reference.avgDurationMin !== null && reference.avgDurationMin < 420;

    if (short || debtHigh) {
      insights.push({
        key: "sleep-short",
        kind: "reminder",
        tone: "orange",
        title: short ? "睡眠时长不足" : "睡眠债在累积",
        body: `${refLabel}平均 ${reference.avgDurationMin === null ? "—" : `${Math.floor(reference.avgDurationMin / 60)}h${String(reference.avgDurationMin % 60).padStart(2, "0")}m`}，睡眠债约 ${reference.debtMin === null ? "—" : `${Math.round(reference.debtMin / 60)} 小时`}。今晚把上床时间提前 30–60 分钟，比周末一次补觉更有效。`,
        evidence: reference.note,
        confidence: reference.confidence,
        priority: 1,
      });
    } else {
      insights.push({
        key: "sleep-duration-ok",
        kind: "observation",
        tone: "green",
        title: "睡眠时长达标",
        body: `${refLabel}平均 ${Math.floor((reference.avgDurationMin ?? 0) / 60)}h${String((reference.avgDurationMin ?? 0) % 60).padStart(2, "0")}m，达到 ${Math.floor(sleepTargetMin / 60)}h${String(sleepTargetMin % 60).padStart(2, "0")}m 目标。`,
        evidence: reference.note,
        confidence: reference.confidence,
        priority: 6,
      });
    }

    if (late) {
      insights.push({
        key: "sleep-late",
        kind: "reminder",
        tone: "amber",
        title: "入睡时间偏晚",
        body: `${refLabel}平均入睡 ${bedtimeOffsetToClock(reference.avgBedtimeOffsetMin) ?? "—"}，比建议的 ${input.bedtimeTarget ?? DEFAULT_BEDTIME_TARGET} 晚 30 分钟以上。先固定起床时间，再逐步把上床时间提前 15 分钟。`,
        evidence: `目标入睡 ${input.bedtimeTarget ?? DEFAULT_BEDTIME_TARGET} · 实际 ${bedtimeOffsetToClock(reference.avgBedtimeOffsetMin) ?? "—"}`,
        confidence: reference.confidence,
        priority: 2,
      });
    }

    if (reference.flags.irregular) {
      insights.push({
        key: "sleep-irregular",
        kind: "suggestion",
        tone: "amber",
        title: "作息波动偏大",
        body: `${refLabel}入睡时间波动约 ±${reference.bedtimeStdMin} 分钟。固定起床时间、睡前 1 小时调暗灯光，通常比强迫自己早睡更容易坚持。`,
        evidence: `波动 ≤30 分钟为规律；当前 ${reference.regularityLabel}`,
        confidence: reference.confidence,
        priority: 3,
      });
    }

    if (reference.flags.lowDeep) {
      insights.push({
        key: "sleep-deep-low",
        kind: "suggestion",
        tone: "lilac",
        title: "深睡占比偏低",
        body: `${refLabel}深睡平均 ${reference.avgDeepPct}%，低于常见参考区间 15–20%。睡前一小时减少屏幕与酒精，卧室保持 18–22°C。`,
        evidence: `${reference.nightsWithStages} 晚有分期数据`,
        confidence: reference.confidence,
        priority: 4,
      });
    }

    if (reference.flags.lowEfficiency) {
      insights.push({
        key: "sleep-efficiency-low",
        kind: "suggestion",
        tone: "blue",
        title: "睡眠效率偏低",
        body: `${refLabel}睡眠效率平均 ${Math.round(reference.avgEfficiencyPct ?? 0)}%，低于 85%。如果躺下 20 分钟还睡不着，先起身做点安静的事，困了再回床。`,
        evidence: "效率 = 实际睡眠 / 卧床时长",
        confidence: reference.confidence,
        priority: 4,
      });
    }
  }

  /* ---------- 训练 ---------- */
  if (
    finite(trainingDaysPerWeek) &&
    trainingDaysPerWeek >= 3 &&
    finite(workoutDays7) &&
    workoutDays7 < Math.min(3, Math.ceil(trainingDaysPerWeek * 0.6))
  ) {
    insights.push({
      key: "training-low",
      kind: "suggestion",
      tone: "blue",
      title: "本周训练还差一点",
      body: `目标每周 ${trainingDaysPerWeek} 次，近 7 天记录 ${workoutDays7} 次。安排一次 20–30 分钟的力量或快走，先保住频率。`,
      evidence: `近 7 天训练 ${workoutDays7} 天`,
      confidence: "early",
      priority: 5,
    });
  }

  insights.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));

  /* ---------- 提醒候选 ---------- */
  const reminders: HealthReminderCandidate[] = [];

  // 与洞察保持同一口径：四周达标优先用四周，否则退回一周。
  const sleepReminderRef = sleep28.meetsMinimum ? sleep28 : sleep7.meetsMinimum ? sleep7 : null;
  const sleepReminderActive =
    sleepReminderRef !== null &&
    (sleepReminderRef.flags.shortSleep || (sleepReminderRef.debtMin ?? 0) >= 180 || sleepReminderRef.flags.lateBedtime || sleepReminderRef.flags.irregular);
  if (sleepReminderActive) {
    const scheduleOffset = clamp(bedtimeTargetOffset - 90, -210, -30); // 20:30–23:30
    const raw = (scheduleOffset + 1440) % 1440;
    reminders.push({
      key: "early-sleep",
      title: "该准备睡了",
      body: `目标 ${input.bedtimeTarget ?? DEFAULT_BEDTIME_TARGET} 前上床。把灯光调暗、手机放远一点，给身体 30 分钟降速。`,
      hour: Math.floor(raw / 60),
      minute: raw % 60,
      windowLabel: minutesToClock(scheduleOffset),
      confidence: sleepReminderRef?.confidence ?? sleep7.confidence,
      evidence: sleepReminderRef?.note ?? sleep7.note,
      active: true,
    });
  }

  const proteinReminderRef = nutrition28.meetsMinimum ? nutrition28 : nutrition7.meetsMinimum ? nutrition7 : null;
  const proteinAvg = proteinReminderRef?.avgProteinG ?? null;
  const proteinRatio = plan.proteinG > 0 && proteinAvg !== null ? proteinAvg / plan.proteinG : 1;
  const proteinReminderActive = proteinReminderRef !== null && proteinRatio < 0.85;
  const proteinRefLabel = proteinReminderRef?.windowDays === 28 ? "近 4 周" : "近 7 天";
  if (proteinReminderActive) {
    reminders.push({
      key: "protein",
      title: "今天补够蛋白质",
      body: `${proteinRefLabel}平均 ${Math.round(proteinAvg ?? 0)}g / 目标 ${plan.proteinG}g。下午加一份酸奶、鸡蛋或豆制品，比晚上一次补更稳。`,
      hour: 16,
      minute: 30,
      windowLabel: "16:30",
      confidence: proteinReminderRef?.confidence ?? nutrition7.confidence,
      evidence: proteinReminderRef?.note ?? nutrition7.note,
      active: true,
    });
  }

  return { insights, reminders, nutrition7, nutrition28, sleep7, sleep28 };
}

/* ------------------------------------------------------------------ */
/* 5. 提醒调度（本地通知的纯计算部分）                                */
/* ------------------------------------------------------------------ */

/** 从 now 起为某个每日提醒生成未来 days 次触发时间（本地时区） */
export function nextReminderOccurrences(
  reminder: Pick<HealthReminderCandidate, "hour" | "minute" | "active">,
  now: Date = new Date(),
  days = 7
): Date[] {
  if (!reminder.active) return [];
  const out: Date[] = [];
  const count = clamp(Math.round(days), 1, 30);
  for (let i = 0; i <= 30 && out.length < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, reminder.hour, reminder.minute, 0, 0);
    if (date.getTime() > now.getTime() + 30_000) out.push(date);
  }
  return out;
}

/** 提醒是否应被静默时段拦截（true = 不调度） */
export function reminderBlockedByQuietHours(
  reminder: Pick<HealthReminderCandidate, "hour" | "minute">,
  prefs: ReminderPrefs
): boolean {
  return inQuietHours(reminder.hour, reminder.minute, prefs.quietStart, prefs.quietEnd);
}
