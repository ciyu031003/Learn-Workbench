import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { sleepApi, mergeHealthNights, type SleepNight } from "@/lib/sleep-api";
import { bedtimeOffsetMin, shiftSleepDate } from "@/lib/sleep-view";
import { fetchNutritionTarget } from "@/lib/wellbeing-client";
import { todayISO } from "@learn-workbench/shared/dates";
import {
  buildEnergyPlan,
  buildHealthBriefing,
  buildNutritionBaseline,
  buildSleepAssessment,
  type NutritionDaySample,
  type SleepNightSample,
} from "@learn-workbench/shared/health-rules";
import {
  fetchHealthProfile,
  saveHealthProfile,
  type HealthProfileDto,
  type HealthProfileResponse,
} from "./health-client";
import { syncSleepTarget } from "./use-sleep-target";
import {
  cancelAllHealthReminders,
  rememberHealthReminderPlan,
  requestHealthNotificationPermission,
  scheduleTestHealthReminder,
  syncHealthReminders,
} from "./health-reminder";

interface WorkoutLite {
  exercisedOn?: unknown;
}

function fallbackProfile(partial: Partial<HealthProfileDto> = {}): HealthProfileDto {
  return {
    weightKg: 60,
    heightCm: null,
    birthYear: null,
    sex: null,
    activityLevel: null,
    bodyGoal: "maintain",
    trainingDaysPerWeek: null,
    sleepTargetMinutes: 450,
    bedtimeTarget: "23:30",
    reminderPrefs: {},
    ...partial,
  };
}

function toSleepSample(night: SleepNight): SleepNightSample {
  const stages = night.stages;
  const total = stages ? stages.deep + stages.light + stages.rem + stages.awake : 0;
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : null);
  return {
    date: night.date,
    durationMin: night.durationMin,
    efficiencyPct: night.efficiencyPct,
    deepPct: pct(stages?.deep ?? 0),
    remPct: pct(stages?.rem ?? 0),
    awakeCount: night.awakeCount,
    bedtimeOffsetMin: bedtimeOffsetMin(night),
  };
}

/**
 * 健康基线取数 / 派生层。
 *
 * 服务端：/api/health/profile、/api/nutrition/summary?days=28、/api/workouts?days=28
 * 本机：sleepApi（手动 + Health Connect 合并）
 *
 * 任何一路失败都保留其他数据；健康 profile 接口失败时回落到 /api/nutrition/target，
 * 保证旧服务端 / 弱网下页面仍能打开。
 */
export function useHealthBaseline() {
  const token = useAppStore((s) => s.token);
  const todayKey = useMemo(() => todayISO(), []);

  const [response, setResponse] = useState<HealthProfileResponse | null>(null);
  const [nutritionRows, setNutritionRows] = useState<NutritionDaySample[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLite[]>([]);
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);


  const load = useCallback(async () => {
    setError(null);
    const headers: Record<string, string> = token ? { Authorization: "Bearer " + token } : {};
    const [profileRes, nutritionRes, workoutRes, sleepRes] = await Promise.all([
      fetchHealthProfile(token).catch(() => null),
      fetch(`${getApiUrl()}/api/nutrition/summary?days=28`, {
        headers: { ...headers, "Cache-Control": "no-cache" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`${getApiUrl()}/api/workouts?days=28`, {
        headers: { ...headers, "Cache-Control": "no-cache" },
        cache: "no-store",
      }).catch(() => null),
      (async () => {
        const local = await sleepApi.loadSleepNights();
        const health = await sleepApi.readSleepNightsFromHealth({ days: 31 });
        return mergeHealthNights(local, health.nights);
      })().catch(() => [] as SleepNight[]),
    ]);

    let nextResponse = profileRes;
    if (!nextResponse) {
      // 旧服务端 / 健康接口暂不可用：用已有的营养目标接口兜底
      const fallback = await fetchNutritionTarget(token).catch(() => null);
      if (fallback) {
        const profile = fallbackProfile({
          weightKg: fallback.profile.weightKg,
          heightCm: fallback.profile.heightCm,
          birthYear: fallback.profile.birthYear,
          sex: fallback.profile.sex,
          activityLevel: fallback.profile.activityLevel,
          bodyGoal: fallback.profile.bodyGoal ?? "maintain",
          trainingDaysPerWeek: fallback.profile.trainingDaysPerWeek ?? null,
        });
        nextResponse = { profile, plan: buildEnergyPlan(profile) };
      } else {
        const profile = fallbackProfile();
        nextResponse = { profile, plan: buildEnergyPlan(profile) };
      }
    }
    setResponse(nextResponse);

    if (nutritionRes?.ok) {
      const data = await nutritionRes.json().catch(() => null);
      const list = Array.isArray(data?.summary) ? data.summary : [];
      setNutritionRows(
        list.map((row: Record<string, unknown>) => ({
          date: String(row.date ?? "").slice(0, 10),
          kcal: Number(row.kcal) || 0,
          proteinG: Number(row.proteinG) || 0,
          carbsG: Number(row.carbsG) || 0,
          fatG: Number(row.fatG) || 0,
          entryCount: Number(row.entryCount) || 0,
        }))
      );
    } else {
      setNutritionRows([]);
    }

    if (workoutRes?.ok) {
      const data = await workoutRes.json().catch(() => null);
      setWorkouts(Array.isArray(data?.workouts) ? data.workouts : []);
    } else {
      setWorkouts([]);
    }

    setNights(sleepRes);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useFocusRefresh(load);

  // 兜底对象只创建一次：避免每次渲染都生成新 profile / plan，让下游 useMemo 全部失效。
  const profile = useMemo(() => response?.profile ?? fallbackProfile(), [response]);
  const plan = useMemo(() => response?.plan ?? buildEnergyPlan(profile), [response, profile]);

  const nutrition7 = useMemo(
    () => buildNutritionBaseline(nutritionRows, { windowDays: 7, endDate: todayKey }),
    [nutritionRows, todayKey]
  );
  const nutrition28 = useMemo(
    () => buildNutritionBaseline(nutritionRows, { windowDays: 28, endDate: todayKey }),
    [nutritionRows, todayKey]
  );
  const sleepSamples = useMemo(() => nights.map(toSleepSample), [nights]);
  const sleep7 = useMemo(
    () =>
      buildSleepAssessment(sleepSamples, {
        windowDays: 7,
        endDate: todayKey,
        targetMin: profile.sleepTargetMinutes,
        bedtimeTarget: profile.bedtimeTarget,
      }),
    [sleepSamples, todayKey, profile.sleepTargetMinutes, profile.bedtimeTarget]
  );
  const sleep28 = useMemo(
    () =>
      buildSleepAssessment(sleepSamples, {
        windowDays: 28,
        endDate: todayKey,
        targetMin: profile.sleepTargetMinutes,
        bedtimeTarget: profile.bedtimeTarget,
      }),
    [sleepSamples, todayKey, profile.sleepTargetMinutes, profile.bedtimeTarget]
  );

  const workoutDays7 = useMemo(() => {
    const start = shiftSleepDate(todayKey, -6);
    const days = new Set<string>();
    for (const workout of workouts) {
      const day = typeof workout.exercisedOn === "string" ? workout.exercisedOn.slice(0, 10) : "";
      if (day && day >= start && day <= todayKey) days.add(day);
    }
    return days.size;
  }, [workouts, todayKey]);

  const briefing = useMemo(
    () =>
      buildHealthBriefing({
        plan,
        nutrition7,
        nutrition28,
        sleep7,
        sleep28,
        sleepTargetMin: profile.sleepTargetMinutes,
        bedtimeTarget: profile.bedtimeTarget,
        trainingDaysPerWeek: profile.trainingDaysPerWeek,
        workoutDays7,
      }),
    [plan, nutrition7, nutrition28, sleep7, sleep28, profile, workoutDays7]
  );

  // 规则 / 偏好变化时重排未来 7 天提醒；全关时清掉旧闹钟
  useEffect(() => {
    const prefs = profile.reminderPrefs;
    if (!prefs.earlySleep && !prefs.protein) {
      cancelAllHealthReminders();
      return;
    }
    syncHealthReminders(briefing.reminders, prefs);
    void rememberHealthReminderPlan(briefing.reminders, prefs);
  }, [briefing.reminders, profile.reminderPrefs]);

  const save = useCallback(
    async (partial: Partial<HealthProfileDto>) => {
      setSaving(true);
      setError(null);
      try {
        const next = await saveHealthProfile(token, partial);
        setResponse(next);
        syncSleepTarget(Number(next.profile.sleepTargetMinutes));
        return next;
      } catch {
        setError("保存失败，请检查网络后重试");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  const toggleReminder = useCallback(
    async (key: "earlySleep" | "protein", enabled: boolean) => {
      if (enabled) {
        const granted = await requestHealthNotificationPermission();
        if (!granted) {
          setReminderMessage("通知权限未开启，暂时只能在页内看到提醒");
          return false;
        }
      }
      const nextPrefs = { ...profile.reminderPrefs, [key]: enabled };
      const saved = await save({ reminderPrefs: nextPrefs });
      setReminderMessage(saved ? (enabled ? "提醒已开启" : "提醒已关闭") : "提醒设置保存失败");
      return Boolean(saved);
    },
    [profile.reminderPrefs, save]
  );

  const sendTestReminder = useCallback(async () => {
    const ok = await scheduleTestHealthReminder();
    setReminderMessage(ok ? "测试通知已安排，5 秒后送达" : "当前设备暂不支持通知，或权限未开启");
    return ok;
  }, []);

  return {
    loading,
    saving,
    error,
    reminderMessage,
    profile,
    plan,
    nutrition7,
    nutrition28,
    sleep7,
    sleep28,
    workoutDays7,
    briefing,
    nights,
    load,
    save,
    toggleReminder,
    sendTestReminder,
  };
}
