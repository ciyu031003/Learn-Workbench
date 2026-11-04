"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ReadinessHero } from "@/components/wellbeing/readiness-hero";
import { Skeleton } from "@/components/ui/skeleton";

/** 3D 水杯懒加载（ssr:false）：与状态球共用 three 异步 chunk */
const WaterGlass3D = dynamic(() => import("@/components/three/water-glass-3d").then((m) => m.WaterGlass3D), {
  ssr: false,
  loading: () => <Skeleton className="h-[145px] w-[116px]" rounded="rounded-2xl" />,
});
import {
  Droplets,
  Zap,
  Coffee,
  Bell,
  HeartPulse,
  Plus,
  Trash2,
  Check,
  Pencil,
  Footprints,
  Timer as TimerIcon,
  ListChecks,
  GlassWater,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Volleyball,
  Bike,
  Dumbbell,
  BicepsFlexed,
  Salad,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { cn } from "@/lib/utils";
import { apiGet, apiMutate, ApiError, isAbortError } from "@/lib/client-api";
import { AsyncSection } from "@/components/async-section";
import { useToastStore } from "@/store/toast-store";
import { ExerciseSheet, useSportCatalog } from "@/components/sport/exercise-sheet";
import type { ExerciseType, WellbeingToday, WellbeingReminder, DailyPlanItem } from "@learn-workbench/shared/schemas";
import type { SportItem } from "@learn-workbench/shared/types";
import { sportTypeFallbackItem, energyLevelLabels, energyLevelColors, reminderTypeLabels, breakKindLabels, exerciseTypeOptions, exerciseTypeLabels } from "@learn-workbench/shared/labels";
import { sportCalories } from "@learn-workbench/shared/pure";

const QUICK_WATER = [200, 250, 350];
const BREAK_PRESETS = [
  { kind: "SHORT", label: "短休", minutes: 5, icon: Coffee },
  { kind: "EYE_REST", label: "远眺", minutes: 2, icon: HeartPulse },
  { kind: "MOVEMENT", label: "活动", minutes: 10, icon: Footprints },
  { kind: "LONG", label: "长休", minutes: 15, icon: GlassWater },
] as const;
const REMINDER_PRESETS = [
  { type: "HYDRATION", title: "喝水提醒", intervalMinutes: 90 },
  { type: "STAND", title: "站立提醒", intervalMinutes: 60 },
  { type: "BREAK", title: "休息提醒", intervalMinutes: 50 },
] as const;

/** 今日建议的图标配色：全走主题 token（去掉裸色值），深浅色自动跟随 */
const planKindMeta: Record<DailyPlanItem["kind"], { icon: typeof TimerIcon; chip: string; tone: string }> = {
  focus: { icon: TimerIcon, chip: "bg-primary/12", tone: "text-primary" },
  break: { icon: Coffee, chip: "bg-success/12", tone: "text-success" },
  hydrate: { icon: GlassWater, chip: "bg-primary/12", tone: "text-primary" },
  energy: { icon: Zap, chip: "bg-warning/12", tone: "text-warning" },
  task: { icon: ListChecks, chip: "bg-background-tertiary-default", tone: "text-text-secondary" },
  review: { icon: HeartPulse, chip: "bg-accent/12", tone: "text-accent" },
  move: { icon: Activity, chip: "bg-success/12", tone: "text-success" },
};

const exerciseTypeIcons: Record<string, typeof Volleyball> = {
  BALL: Volleyball,
  AEROBIC: Bike,
  STRENGTH: Dumbbell,
  STRETCH: BicepsFlexed,
  MOVE: Footprints,
  OTHER: Activity,
};

/** 卡片头部小徽标（数值摘要 / 状态胶囊） */
function StatPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-background-tertiary-default px-2.5 py-1 text-caption-1-medium text-text-secondary">
      {children}
    </span>
  );
}

/**
 * 健康页统一卡片：rounded-3xl 语义表面 + 图标块标题 + 卡内滚动区。
 * 头部留在滚动区外，长记录列表不会再顶掉标题；固定高度卡片由调用方传 md:h-[340px]。
 */
function SectionCard({
  icon: Icon,
  title,
  badge,
  action,
  className,
  bodyClassName,
  children,
}: {
  icon: typeof Droplets;
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default",
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-5 pb-3 pt-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default text-foreground-icon-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <h2 className="min-w-0 truncate text-title-3-semibold text-text-primary">{title}</h2>
        {badge || action ? (
          <div className="ms-auto flex shrink-0 items-center gap-1.5">
            {badge}
            {action}
          </div>
        ) : null}
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col px-5 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}

function HydrationRing({ totalMl, targetMl }: { totalMl: number; targetMl: number }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const p = targetMl > 0 ? Math.min(100, Math.round((totalMl / targetMl) * 100)) : 0;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="hyd-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-primary-strong)" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="url(#hyd-ring)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-title-2-medium tabular-nums text-text-primary">{totalMl}ml</span>
        <span className="text-caption-2-medium text-text-tertiary">目标 {targetMl}ml · {p}%</span>
      </div>
    </div>
  );
}

export default function WellbeingPage() {
  const [today, setToday] = useState<WellbeingToday | null>(null);
  const [reminders, setReminders] = useState<WellbeingReminder[]>([]);
  const [error, setError] = useState<string | null>(null);
  // S6-1：数据块三态（loading / error / ready），错误态提供「重试」
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const pushToast = useToastStore((s) => s.push);

  const [customMl, setCustomMl] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [energyNote, setEnergyNote] = useState("");

  const [showAddReminder, setShowAddReminder] = useState(false);
  const [rmType, setRmType] = useState("HYDRATION");
  const [rmTitle, setRmTitle] = useState("");
  const [rmInterval, setRmInterval] = useState("90");

  // ---- 卡路里估算：体重设置（默认 60kg，MET × 体重 × 小时） ----
  const [weightKg, setWeightKg] = useState(60);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState("60");
  // ---- 每类运动周统计（近 7 天按大类聚合分钟数） ----
  const [weekByType, setWeekByType] = useState<{ type: ExerciseType; minutes: number }[]>([]);
  const catalog = useSportCatalog();

  const loadProfile = useCallback(async () => {
    try {
      const d = await apiGet<{ weightKg?: number }>("/api/wellbeing/profile");
      setWeightKg(Number(d?.weightKg) || 60);
    } catch (e) {
      if (isAbortError(e)) return;
      // 读不到就保持默认 60kg
    }
  }, []);

  const saveWeight = async () => {
    const v = Number(weightInput);
    if (!Number.isFinite(v) || v < 20 || v > 300) return;
    try {
      const d = await apiMutate<{ weightKg?: number }>("/api/wellbeing/profile", "PUT", { weightKg: v });
      setWeightKg(Number(d?.weightKg) || 60);
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "体重保存失败，请重试", "error");
    }
    setEditingWeight(false);
  };

  // ---- 运动模块：类型 / 时长 / 倒计时 / 目标 ----
  const [exerciseType, setExerciseType] = useState<ExerciseType>("BALL");
  const [exLabel, setExLabel] = useState("");
  const [exMinutes, setExMinutes] = useState("20");
  const [exTarget, setExTarget] = useState(String(today?.exercise?.targetMinutes ?? 30));
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const [editingExTarget, setEditingExTarget] = useState(false);
  const [timerTotal, setTimerTotal] = useState(0);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const loadToday = useCallback(async (signal?: AbortSignal) => {
    try {
      const t = await apiGet<WellbeingToday>("/api/wellbeing/today", { signal });
      if (signal?.aborted) return;
      setToday(t);
      setExTarget(String(t?.exercise?.targetMinutes ?? 30));
      setError(null);
      setStatus("ready");
    } catch (e) {
      if (isAbortError(e)) return;
      setError(e instanceof ApiError ? e.message : "健康数据加载失败，请确认数据库已启动");
      setStatus("error");
    }
  }, []);

  const loadReminders = useCallback(async () => {
    try {
      const d = await apiGet<{ reminders?: WellbeingReminder[] }>("/api/wellbeing/reminders");
      setReminders(d?.reminders ?? []);
    } catch {
      // 提醒列表加载失败不阻塞主流程
    }
  }, []);

  const loadWeekly = useCallback(async () => {
    try {
      const d = await apiGet<{ byType?: { type: ExerciseType; minutes: number }[] }>("/api/wellbeing/exercise?days=7");
      setWeekByType(Array.isArray(d?.byType) ? d.byType : []);
    } catch {
      // 周统计加载失败不影响主流程
    }
  }, []);

  // 数据加载：AbortController 随组件卸载/重试取消，避免切页后 setState 警告；
  // 延迟一宏任务再发请求，避免在 effect body 同步 setState（react-hooks/set-state-in-effect）
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadToday(controller.signal);
      void loadReminders();
      void loadProfile();
      void loadWeekly();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadToday, loadReminders, loadProfile, loadWeekly]);

  // 错误态「重试」：重新拉起主数据（保留页头/状态球，不等整页刷新）
  const retryLoad = useCallback(() => {
    setStatus("loading");
    void loadToday();
    void loadReminders();
    void loadWeekly();
  }, [loadToday, loadReminders, loadWeekly]);

  const logExercise = useCallback(
    async (durationSeconds: number, source = "MANUAL") => {
      if (durationSeconds <= 0) return;
      try {
        await apiMutate("/api/wellbeing/exercise", "POST", { type: exerciseType, typeLabel: exLabel.trim() || null, durationSeconds, source });
        loadToday();
        loadWeekly();
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "运动记录失败，请重试", "error");
      }
    },
    [exerciseType, exLabel, loadToday, loadWeekly, pushToast]
  );

  const startTimer = () => {
    const mins = Math.max(1, Number(exMinutes) || 1);
    const total = mins * 60;
    setTimerTotal(total);
    setTimerLeft(total);
    setTimerRunning(true);
  };

  const toggleTimer = () => setTimerRunning((v) => !v);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerTotal(0);
    setTimerLeft(0);
  };

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!timerRunning || timerLeft !== 0 || timerTotal <= 0) return;
    const total = timerTotal;
    void logExercise(total, "FOCUS");
    setTimerRunning(false);
    setTimerTotal(0);
  }, [timerRunning, timerLeft, timerTotal, logExercise]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const recordNow = async () => {
    if (timerRunning) return;
    await logExercise((Math.max(0, Number(exMinutes) || 0)) * 60, "MANUAL");
  };

  const saveExTarget = async () => {
    const v = Number(exTarget);
    if (!Number.isFinite(v) || v < 1 || v > 600) return;
    try {
      await apiMutate("/api/wellbeing/exercise/goal", "PUT", { targetMinutes: v });
      setEditingExTarget(false);
      loadToday();
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "目标保存失败，请重试", "error");
    }
  };

  const addWater = async (ml: number) => {
    // 乐观更新：先加毫升数，失败回滚 + toast（不再等接口返回才有反馈）
    const snapshot = today;
    setToday((prev) =>
      prev && prev.hydration
        ? { ...prev, hydration: { ...prev.hydration, totalMl: prev.hydration.totalMl + ml } }
        : prev
    );
    try {
      await apiMutate("/api/wellbeing/hydration", "POST", { amountMl: ml, source: "MANUAL" });
      await loadToday();
    } catch (e) {
      setToday(snapshot);
      pushToast(e instanceof ApiError ? e.message : "饮水记录失败，已回滚", "error");
    }
  };

  const saveGoal = async () => {
    const v = Number(goalInput);
    if (!Number.isFinite(v) || v < 200) return;
    try {
      await apiMutate("/api/wellbeing/goal", "PUT", { targetMl: v });
      setEditingGoal(false);
      loadToday();
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "饮水目标保存失败，请重试", "error");
    }
  };

  const saveEnergy = async () => {
    if (energyLevel === null) return;
    try {
      await apiMutate("/api/wellbeing/energy", "POST", { level: energyLevel, note: energyNote || null, source: "MANUAL" });
      setEnergyNote("");
      loadToday();
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "精力记录失败，请重试", "error");
    }
  };

  const recordBreak = async (kind: string, minutes: number) => {
    try {
      await apiMutate("/api/wellbeing/breaks", "POST", { kind, minutes });
      loadToday();
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "休息记录失败，请重试", "error");
    }
  };

  const addReminderPreset = async (p: { type: string; title: string; intervalMinutes: number }) => {
    try {
      await apiMutate("/api/wellbeing/reminders", "POST", p);
      loadReminders();
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "提醒添加失败，请重试", "error");
    }
  };

  const addReminder = async () => {
    if (!rmTitle.trim()) return;
    try {
      await apiMutate("/api/wellbeing/reminders", "POST", { type: rmType, title: rmTitle.trim(), intervalMinutes: Number(rmInterval) || 60 });
      setRmTitle("");
      setShowAddReminder(false);
      loadReminders();
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "提醒添加失败，请重试", "error");
    }
  };

  const toggleReminder = async (id: number, enabled: boolean) => {
    // 乐观更新开关，失败回滚 + toast
    const snapshot = reminders;
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    try {
      await apiMutate("/api/wellbeing/reminders", "PATCH", { id, enabled });
      await loadReminders();
    } catch (e) {
      setReminders(snapshot);
      pushToast(e instanceof ApiError ? e.message : "提醒更新失败，已回滚", "error");
    }
  };

  const deleteReminder = async (id: number) => {
    // 乐观移除，失败回滚 + toast
    const snapshot = reminders;
    setReminders((prev) => prev.filter((r) => r.id !== id));
    try {
      await apiMutate("/api/wellbeing/reminders?id=" + id, "DELETE");
      await loadReminders();
    } catch (e) {
      setReminders(snapshot);
      pushToast(e instanceof ApiError ? e.message : "提醒删除失败，已回滚", "error");
    }
  };

  const latestEnergy = today?.energy ?? null;
  const plan = today?.plan ?? [];
  const hydration = today?.hydration;
  const exerciseToday = today?.exercise;
  const timerText =
    timerLeft > 0
      ? ("0" + Math.floor(timerLeft / 60)).slice(-2) + ":" + ("0" + (timerLeft % 60)).slice(-2)
      : "00:00";

  // 今日卡路里估算：按 typeLabel 匹配注册表 MET，匹配不到按大类兜底
  const todayKcal = useMemo(() => {
    const logs = exerciseToday?.logs ?? [];
    return Math.round(
      logs.reduce((sum, l) => {
        const item = catalog.find((s) => s.name === l.typeLabel) ?? sportTypeFallbackItem[l.type];
        return sum + sportCalories(item?.met ?? 4, weightKg, l.durationSeconds);
      }, 0)
    );
  }, [exerciseToday?.logs, catalog, weightKg]);

  // 本周统计：按大类分钟数（byType）+ 兜底 MET 估算的周卡路里
  const weekRows = useMemo(
    () =>
      exerciseTypeOptions.map((o) => ({
        ...o,
        minutes: weekByType.find((b) => b.type === o.type)?.minutes ?? 0,
      })),
    [weekByType]
  );
  const weekTotalMinutes = weekRows.reduce((a, r) => a + r.minutes, 0);
  const weekKcal = Math.round(
    weekRows.reduce((a, r) => a + sportCalories(sportTypeFallbackItem[r.type].met, weightKg, r.minutes * 60), 0)
  );
  const weekMax = Math.max(1, ...weekRows.map((r) => r.minutes));
  const exerciseLogs = exerciseToday?.logs ?? [];
  const exercisePct = exerciseToday?.targetMinutes
    ? Math.min(100, Math.round(((exerciseToday?.totalMinutes ?? 0) / exerciseToday.targetMinutes) * 100))
    : 0;

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="健康与状态"
        description="Focus → 休息 → 饮水 → 精力，照顾好状态才有持续成长"
        icon={<HeartPulse className="size-5" />}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/wellbeing/workout">
                <Dumbbell className="size-4" /> 训练记录
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/wellbeing/nutrition">
                <Salad className="size-4" /> 今日饮食
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/wellbeing/sports">
                <Trophy className="size-4" /> 运动档案
              </Link>
            </Button>
          </>
        }
      />

      {/* v8 P3：3D 状态球 hero（状态分 + 四项分解 + 本周概览） */}
      <ReadinessHero />

      {/* S6-1：数据块三态 —— 断网/500 显示「加载失败 + 重试」，加载中显示骨架 */}
      {status === "error" ? (
        <AsyncSection status="error" errorMessage={error ?? "加载失败，请稍后重试"} onRetry={retryLoad} />
      ) : status === "loading" ? (
        <AsyncSection status="loading" loadingLabel="正在加载健康数据…" skeletonRows={4} />
      ) : null}

      {/* 2 列卡片网格（窄屏 1 列）：指标 / 图表 / 记录不再各自贯穿整页 */}
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {/* 今日饮水 */}
        <SectionCard icon={Droplets} title="今日饮水">
          <div className="flex flex-1 flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <WaterGlass3D
                ratio={(hydration?.totalMl ?? 0) / Math.max(1, hydration?.targetMl ?? 2000)}
                size={116}
              />
              <HydrationRing totalMl={hydration?.totalMl ?? 0} targetMl={hydration?.targetMl ?? 2000} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {QUICK_WATER.map((ml) => (
                <button
                  key={ml}
                  onClick={() => addWater(ml)}
                  className="press rounded-full border border-border bg-muted/50 px-3 py-1.5 text-body-medium text-text-primary transition-all hover:border-accent/40 hover:bg-accent/10 active:bg-accent/15"
                >
                  +{ml}ml
                </button>
              ))}
              <div className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-1">
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={customMl}
                  onChange={(e) => setCustomMl(e.target.value)}
                  placeholder="自定义"
                  aria-label="自定义饮水量"
                  className="w-16 bg-transparent text-center text-body-medium text-text-primary placeholder:text-text-tertiary"
                />
                <button
                  onClick={() => {
                    const v = Number(customMl);
                    if (v > 0) addWater(v);
                    setCustomMl("");
                  }}
                  aria-label="记录饮水量"
                  className="press rounded-full p-1 text-accent transition-colors hover:bg-accent/12"
                >
                  <Check className="check-draw size-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-caption-1-medium text-text-secondary">
              {editingGoal ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={200}
                    max={10000}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="h-8 w-28"
                    aria-label="每日饮水目标"
                  />
                  <Button size="sm" onClick={saveGoal}>保存</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingGoal(false)}>取消</Button>
                </div>
              ) : (
                <>
                  <span>每日目标 {hydration?.targetMl ?? 2000}ml</span>
                  <button
                    onClick={() => {
                      setGoalInput(String(hydration?.targetMl ?? 2000));
                      setEditingGoal(true);
                    }}
                    aria-label="修改饮水目标"
                    className="rounded-lg p-1 text-text-tertiary transition-colors hover:bg-muted/75 hover:text-text-primary"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </SectionCard>

        {/* 精力状态 */}
        <SectionCard
          icon={Zap}
          title="精力状态"
          badge={latestEnergy ? <StatPill>最近：<span className="font-semibold text-text-primary">{energyLevelLabels[latestEnergy.level]}</span></StatPill> : undefined}
        >
          <div className="flex flex-1 flex-col gap-4">
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lv) => (
                <button
                  key={lv}
                  onClick={() => setEnergyLevel(lv)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-all",
                    energyLevel === lv
                      ? "scale-105 border-transparent text-white"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  )}
                  style={energyLevel === lv ? { backgroundColor: energyLevelColors[lv] } : undefined}
                >
                  <span className="text-headline-semibold">{lv}</span>
                  <span className="text-caption-2-medium">{energyLevelLabels[lv]}</span>
                </button>
              ))}
            </div>
            <textarea
              value={energyNote}
              onChange={(e) => setEnergyNote(e.target.value)}
              placeholder="补充一句（可选）：状态来自睡眠 / 咖啡 / 压力…"
              className="min-h-[64px] w-full resize-none rounded-xl border border-border bg-muted/40 px-3 py-2 text-body-medium text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary/60 focus:bg-surface"
            />
            <Button onClick={saveEnergy} disabled={energyLevel === null} className="self-end">
              <Zap className="size-4" /> 记录精力
            </Button>
            <p className="text-caption-1-medium text-text-secondary">
              只做个人行为统计，用于安排任务强度，不做医学判断。
            </p>
          </div>
        </SectionCard>

        {/* 休息与节奏（固定 340，休息记录卡内滚动） */}
        <SectionCard icon={Coffee} title="休息与节奏" className="md:h-[340px]">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-body-semibold text-text-primary">{today?.focusTodayMinutes ?? 0} 分钟</span>
                <span className="text-caption-2-medium text-text-tertiary">今日专注</span>
              </div>
              {today?.nextBreakDue ? (
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-caption-1-medium text-success">
                  建议休息一下
                </span>
              ) : (
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-caption-1-medium text-text-secondary">
                  节奏良好
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {BREAK_PRESETS.map((b) => (
                <button
                  key={b.kind}
                  onClick={() => recordBreak(b.kind, b.minutes)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-caption-1-medium text-text-primary transition-all hover:bg-muted/75"
                >
                  <b.icon className="size-3.5 text-success" /> {b.label} {b.minutes}′
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              <ScrollFade className="h-full">
                {(today?.breaksToday ?? []).length === 0 ? (
                  <p className="py-2 text-center text-caption-1-medium text-text-tertiary">今天还没有休息记录</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {today?.breaksToday.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-caption-1-medium">
                        <span className="flex items-center gap-1.5 text-text-primary">
                          <Coffee className="size-3.5 text-success" /> {breakKindLabels[b.kind] ?? b.kind}
                        </span>
                        <span className="tabular-nums text-text-tertiary">
                          {new Date(b.startedAt).toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)} · {b.minutes} 分钟
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollFade>
            </div>
          </div>
        </SectionCard>

        {/* 本周运动分布（固定 340，条形图卡内滚动） */}
        <SectionCard
          icon={Activity}
          title="本周运动分布"
          className="md:h-[340px]"
          badge={<StatPill>共 <span className="stat-pop font-semibold text-text-primary">{weekTotalMinutes}</span> 分钟 · ≈{weekKcal} kcal</StatPill>}
        >
          <div className="min-h-0 flex-1">
            <ScrollFade className="h-full">
              {weekTotalMinutes === 0 ? (
                <div className="relative overflow-hidden rounded-2xl px-4 py-7 text-center">
                  <span
                    aria-hidden
                    className="pattern-bauhaus pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
                  />
                  <p className="relative text-caption-1-semibold text-text-primary">本周还没有运动记录</p>
                  <p className="relative mt-1 text-caption-1-medium text-text-tertiary">去「今日运动」记一笔，这里就会出现分布</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {weekRows.map((row) => {
                    const Icon = exerciseTypeIcons[row.type] ?? Activity;
                    const widthPct = row.minutes > 0 ? Math.max(2, Math.round((row.minutes / weekMax) * 100)) + "%" : "0%";
                    return (
                      <div key={row.type} className="flex items-center gap-2.5">
                        <span className="flex w-20 shrink-0 items-center gap-1.5 text-caption-1-medium text-text-secondary">
                          <Icon className="size-3.5 shrink-0 text-success" />
                          {row.label}
                        </span>
                        <div className="h-4 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-success/80 to-success transition-[width] duration-reveal ease-out motion-reduce:transition-none"
                            style={{ width: widthPct }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-caption-1-semibold tabular-nums text-text-primary">
                          {row.minutes}′
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-caption-1-medium text-text-tertiary">
                近 7 天按运动大类统计；周卡路里按各类兜底 MET × 体重估算。
              </p>
            </ScrollFade>
          </div>
        </SectionCard>

        {/* 今日运动（记录表单，高度随内容） */}
        <SectionCard
          icon={Activity}
          title="今日运动"
          badge={
            <StatPill>
              今日 <span className="font-semibold text-text-primary">{exerciseToday?.totalMinutes ?? 0}</span> / {exerciseToday?.targetMinutes ?? 30} 分钟
            </StatPill>
          }
        >
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <Activity className="size-5 shrink-0 text-success" />
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-title-2-medium tabular-nums text-text-primary">
                    {exerciseToday?.totalMinutes ?? 0}
                    <span className="text-caption-1-medium font-normal text-text-tertiary"> 分钟</span>
                  </span>
                  <span className="text-caption-2-medium text-text-tertiary">
                    目标 {exerciseToday?.targetMinutes ?? 30} 分钟 · {exercisePct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="progress-fill h-full rounded-full transition-all"
                    style={{ width: exercisePct + "%" }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-caption-2-medium text-text-tertiary">
                  <span>
                    今日消耗 ≈ <span className="font-semibold text-text-primary">{todayKcal}</span> kcal
                  </span>
                  <span>按体重 {weightKg}kg · MET 估算</span>
                </div>
              </div>
            </div>

            {/* 记录运动 */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="运动类型">
                {exerciseTypeOptions.map((opt) => {
                  const Icon = exerciseTypeIcons[opt.type] ?? Activity;
                  const active = exerciseType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setExerciseType(opt.type)}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-caption-1-medium transition-all",
                        active
                          ? "border-primary/30 bg-primary/12 text-primary-strong shadow-[0_2px_8px_rgba(47,116,192,0.12)]"
                          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSportPickerOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-primary/40 px-3 text-caption-1-medium text-primary-strong transition-all hover:bg-primary/10"
                >
                  <Plus className="size-3.5" /> 选具体项目
                </button>
              </div>
              <Input
                value={exLabel}
                onChange={(e) => setExLabel(e.target.value)}
                placeholder="自定义，如：篮球 / 羽毛球"
                aria-label="运动名称"
                className="h-10"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={exMinutes}
                  onChange={(e) => setExMinutes(e.target.value)}
                  className="h-10 w-24"
                  aria-label="运动时长"
                />
                <span className="text-body-medium text-text-secondary">分钟</span>
                <Button onClick={recordNow} disabled={timerRunning || !(Number(exMinutes) > 0)} className="ml-auto">
                  <Check className="size-4" /> 记录一下
                </Button>
              </div>
            </div>

            {/* 专注运动倒计时 */}
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TimerIcon className="size-5 text-success" />
                  <span className="stat-pop text-title-1-semibold tabular-nums text-text-primary">{timerText}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={startTimer} disabled={timerRunning}>
                    <Play className="size-4" /> 开始
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={toggleTimer}
                    disabled={timerTotal === 0}
                    aria-label={timerRunning ? "暂停" : "继续"}
                  >
                    {timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetTimer} disabled={timerTotal === 0} aria-label="重置倒计时">
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="text-caption-2-medium text-text-tertiary">
                专注运动倒计时，结束时自动记为「专注运动」；配合 {exMinutes || "—"} 分钟初始时长。
              </p>
            </div>

            {/* 每日目标 + 体重（卡路里估算用） */}
            <div className="flex flex-wrap items-center gap-2 text-caption-1-medium text-text-secondary">
              {editingExTarget ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={exTarget}
                    onChange={(e) => setExTarget(e.target.value)}
                    className="h-8 w-28"
                    aria-label="每日运动目标"
                  />
                  <Button size="sm" onClick={saveExTarget}>保存</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingExTarget(false)}>取消</Button>
                </div>
              ) : (
                <>
                  <span>每日目标 {exerciseToday?.targetMinutes ?? 30} 分钟</span>
                  <button
                    onClick={() => {
                      setExTarget(String(exerciseToday?.targetMinutes ?? 30));
                      setEditingExTarget(true);
                    }}
                    aria-label="修改运动目标"
                    className="rounded-lg p-1 text-text-tertiary transition-colors hover:bg-muted/75 hover:text-text-primary"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </>
              )}
              <span className="text-border">|</span>
              {editingWeight ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={20}
                    max={300}
                    step={0.5}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="h-8 w-24"
                    aria-label="体重"
                  />
                  <span className="text-text-secondary">kg</span>
                  <Button size="sm" onClick={saveWeight}>保存</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingWeight(false)}>取消</Button>
                </div>
              ) : (
                <>
                  <span>
                    体重 <span className="font-semibold text-text-primary">{weightKg}</span> kg
                  </span>
                  <button
                    onClick={() => {
                      setWeightInput(String(weightKg));
                      setEditingWeight(true);
                    }}
                    aria-label="修改体重"
                    className="rounded-lg p-1 text-text-tertiary transition-colors hover:bg-muted/75 hover:text-text-primary"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </SectionCard>

        {/* 今日运动记录（固定 340，记录卡内滚动） */}
        <SectionCard
          icon={ListChecks}
          title="今日运动记录"
          className="md:h-[340px]"
          badge={<StatPill>{exerciseLogs.length} 条</StatPill>}
        >
          {exerciseLogs.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-2 text-center text-caption-1-medium text-text-tertiary">
              今天还没有运动记录
            </p>
          ) : (
            <div className="min-h-0 flex-1">
              <ScrollFade className="h-full">
                <div className="flex flex-col gap-1.5">
                  {exerciseLogs.map((l) => (
                    <div
                      key={l.id}
                      className="press-soft flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-caption-1-medium"
                    >
                      <span className="flex items-center gap-1.5 text-text-primary">
                        <Activity className="size-3.5 text-success" /> {l.typeLabel || exerciseTypeLabels[l.type]}
                      </span>
                      <span className="tabular-nums text-text-tertiary">
                        {new Date(l.startedAt).toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)} · {Math.round(l.durationSeconds / 60)} 分钟
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollFade>
            </div>
          )}
        </SectionCard>

        {/* 今日建议（Today Engine） */}
        <SectionCard icon={ListChecks} title="今日建议" className="md:h-[340px]">
          <div className="min-h-0 flex-1">
            <ScrollFade className="h-full">
              {plan.length === 0 ? (
                <p className="py-2 text-center text-caption-1-medium text-text-tertiary">今天还没有建议</p>
              ) : null}
              <div className="flex flex-col gap-1">
                {plan.map((item, i) => {
                  const meta = planKindMeta[item.kind];
                  return (
                    <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          meta.chip,
                          meta.tone
                        )}
                      >
                        <meta.icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-medium text-text-primary">{item.label}</p>
                        {item.hint ? <p className="mt-0.5 text-caption-1-medium text-text-tertiary">{item.hint}</p> : null}
                      </div>
                      <span className="shrink-0 text-caption-1-medium tabular-nums text-text-tertiary">{item.time}</span>
                    </div>
                  );
                })}
              </div>
            </ScrollFade>
          </div>
        </SectionCard>

        {/* 提醒 */}
        <SectionCard
          icon={Bell}
          title="提醒"
          className="md:h-[340px]"
          action={
            <Button variant="secondary" size="sm" onClick={() => setShowAddReminder((v) => !v)}>
              <Plus className="size-4" /> 添加提醒
            </Button>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {showAddReminder ? (
              <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={rmType}
                    onChange={(e) => setRmType(e.target.value)}
                    className="paper-select h-10 rounded-xl px-3 text-body-medium"
                    aria-label="提醒类型"
                  >
                    {Object.entries(reminderTypeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <Input
                    value={rmInterval}
                    onChange={(e) => setRmInterval(e.target.value)}
                    placeholder="间隔（分钟）"
                    aria-label="提醒间隔"
                    className="h-10"
                  />
                </div>
                <Input
                  value={rmTitle}
                  onChange={(e) => setRmTitle(e.target.value)}
                  placeholder="提醒标题，如：起来站一会儿"
                  className="h-10"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddReminder(false)}>取消</Button>
                  <Button size="sm" onClick={addReminder} disabled={!rmTitle.trim()}>
                    <Check className="size-4" /> 保存
                  </Button>
                </div>
              </div>
            ) : null}

            {reminders.length === 0 && !showAddReminder ? (
              <div className="flex shrink-0 flex-col gap-2">
                <p className="text-body-medium text-text-secondary">还没有提醒，一键添加常用节奏：</p>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_PRESETS.map((p) => (
                    <button
                      key={p.type}
                      onClick={() => addReminderPreset(p)}
                      className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-caption-1-medium text-text-primary transition-all hover:bg-muted/75"
                    >
                      {p.title} · 每 {p.intervalMinutes} 分钟
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1">
              <ScrollFade className="h-full">
                <div className="flex flex-col gap-2">
                  {reminders.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                      <span className="icon-chip h-9 w-9 shrink-0">
                        <Bell className="size-4 text-primary" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-medium text-text-primary">{r.title}</p>
                        <p className="text-caption-2-medium text-text-tertiary">
                          {reminderTypeLabels[r.type] ?? r.type} · 每 {r.intervalMinutes} 分钟 · {r.startTime}-{r.endTime}
                        </p>
                      </div>
                      <Switch checked={r.enabled} onCheckedChange={(v) => toggleReminder(r.id, v)} aria-label={r.title + "开关"} />
                      <button
                        onClick={() => deleteReminder(r.id)}
                        aria-label="删除提醒"
                        className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-danger/15 hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollFade>
            </div>
          </div>
        </SectionCard>
      </div>

      <ExerciseSheet
        open={sportPickerOpen}
        mode="pick"
        onClose={() => setSportPickerOpen(false)}
        onSelect={(item: SportItem) => {
          setExerciseType(item.type);
          setExLabel(item.name);
        }}
      />
    </div>
  );
}
