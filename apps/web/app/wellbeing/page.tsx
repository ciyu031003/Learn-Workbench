"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ExerciseSheet } from "@/components/sport/exercise-sheet";
import type { SportItem } from "@learn-workbench/shared";
import {
  energyLevelLabels,
  energyLevelColors,
  reminderTypeLabels,
  breakKindLabels,
  exerciseTypeOptions,
  exerciseTypeLabels,
  type ExerciseType,
  type WellbeingToday,
  type WellbeingReminder,
  type DailyPlanItem,
} from "@learn-workbench/shared";

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

const planKindMeta: Record<DailyPlanItem["kind"], { icon: typeof TimerIcon; color: string }> = {
  focus: { icon: TimerIcon, color: "#2f74c0" },
  break: { icon: Coffee, color: "#3da35d" },
  hydrate: { icon: GlassWater, color: "#2f74c0" },
  energy: { icon: Zap, color: "#d99000" },
  task: { icon: ListChecks, color: "#71717a" },
  review: { icon: HeartPulse, color: "#e1781c" },
  move: { icon: Activity, color: "#3da35d" },
};

const exerciseTypeIcons: Record<string, typeof Volleyball> = {
  BALL: Volleyball,
  AEROBIC: Bike,
  STRENGTH: Dumbbell,
  STRETCH: BicepsFlexed,
  MOVE: Footprints,
  OTHER: Activity,
};

function HydrationRing({ totalMl, targetMl }: { totalMl: number; targetMl: number }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const p = targetMl > 0 ? Math.min(100, Math.round((totalMl / targetMl) * 100)) : 0;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="hyd-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2f74c0" />
            <stop offset="100%" stopColor="#5b93d6" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
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
        <span className="text-xl font-bold tabular-nums">{totalMl}ml</span>
        <span className="text-[11px] text-muted-foreground">目标 {targetMl}ml · {p}%</span>
      </div>
    </div>
  );
}

export default function WellbeingPage() {
  const [today, setToday] = useState<WellbeingToday | null>(null);
  const [reminders, setReminders] = useState<WellbeingReminder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [customMl, setCustomMl] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [energyNote, setEnergyNote] = useState("");

  const [showAddReminder, setShowAddReminder] = useState(false);
  const [rmType, setRmType] = useState("HYDRATION");
  const [rmTitle, setRmTitle] = useState("");
  const [rmInterval, setRmInterval] = useState("90");

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

  const loadToday = useCallback(async () => {
    try {
      const r = await fetch("/api/wellbeing/today");
      if (!r.ok) throw new Error("load failed");
      const t = await r.json();
      setToday(t);
      setExTarget(String(t?.exercise?.targetMinutes ?? 30));
      setError(null);
    } catch {
      setError("健康数据加载失败，请确认数据库已启动");
    }
  }, []);

  const loadReminders = useCallback(async () => {
    const r = await fetch("/api/wellbeing/reminders");
    if (r.ok) setReminders((await r.json()).reminders ?? []);
  }, []);

  useEffect(() => {
    // 数据加载：异步拉取外部系统后 setState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadToday();
    loadReminders();
  }, [loadToday, loadReminders]);

  const logExercise = useCallback(
    async (durationSeconds: number, source = "MANUAL") => {
      if (durationSeconds <= 0) return;
      await fetch("/api/wellbeing/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: exerciseType, typeLabel: exLabel.trim() || null, durationSeconds, source }),
      });
      loadToday();
    },
    [exerciseType, exLabel, loadToday]
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
    await fetch("/api/wellbeing/exercise/goal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetMinutes: v }),
    });
    setEditingExTarget(false);
    loadToday();
  };



  const addWater = async (ml: number) => {
    await fetch("/api/wellbeing/hydration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMl: ml, source: "MANUAL" }),
    });
    loadToday();
  };

  const saveGoal = async () => {
    const v = Number(goalInput);
    if (!Number.isFinite(v) || v < 200) return;
    await fetch("/api/wellbeing/goal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetMl: v }),
    });
    setEditingGoal(false);
    loadToday();
  };

  const saveEnergy = async () => {
    if (energyLevel === null) return;
    await fetch("/api/wellbeing/energy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: energyLevel, note: energyNote || null, source: "MANUAL" }),
    });
    setEnergyNote("");
    loadToday();
  };

  const recordBreak = async (kind: string, minutes: number) => {
    await fetch("/api/wellbeing/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, minutes }),
    });
    loadToday();
  };

  const addReminderPreset = async (p: { type: string; title: string; intervalMinutes: number }) => {
    await fetch("/api/wellbeing/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    loadReminders();
  };

  const addReminder = async () => {
    if (!rmTitle.trim()) return;
    await fetch("/api/wellbeing/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: rmType, title: rmTitle.trim(), intervalMinutes: Number(rmInterval) || 60 }),
    });
    setRmTitle("");
    setShowAddReminder(false);
    loadReminders();
  };

  const toggleReminder = async (id: number, enabled: boolean) => {
    await fetch("/api/wellbeing/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    loadReminders();
  };

  const deleteReminder = async (id: number) => {
    await fetch(`/api/wellbeing/reminders?id=${id}`, { method: "DELETE" });
    loadReminders();
  };

  const latestEnergy = today?.energy ?? null;
  const plan = today?.plan ?? [];
  const hydration = today?.hydration;
  const exerciseToday = today?.exercise;
  const timerText =
    timerLeft > 0
      ? ("0" + Math.floor(timerLeft / 60)).slice(-2) + ":" + ("0" + (timerLeft % 60)).slice(-2)
      : "00:00";

  return (
    <div className="page-enter flex flex-col gap-6">
      <div>
        <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">健康与状态</h1>
        <p className="page-subtitle mt-1 text-sm">
          Focus → 休息 → 饮水 → 精力，照顾好状态才有持续成长
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 今日饮水 */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Droplets className="size-5 text-accent" />
            <CardTitle>今日饮水</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <HydrationRing totalMl={hydration?.totalMl ?? 0} targetMl={hydration?.targetMl ?? 2000} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              {QUICK_WATER.map((ml) => (
                <button
                  key={ml}
                  onClick={() => addWater(ml)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground transition-all hover:bg-muted/75"
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
                  className="w-16 bg-transparent text-center text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => {
                    const v = Number(customMl);
                    if (v > 0) addWater(v);
                    setCustomMl("");
                  }}
                  aria-label="记录饮水量"
                  className="rounded-full p-1 text-accent transition-colors hover:bg-muted/75"
                >
                  <Check className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 精力状态 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-warning" />
              <CardTitle>精力状态</CardTitle>
            </div>
            {latestEnergy ? (
              <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                最近：<span className="font-semibold">{energyLevelLabels[latestEnergy.level]}</span>
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
                  <span className="text-base font-bold">{lv}</span>
                  <span className="text-[10px]">{energyLevelLabels[lv]}</span>
                </button>
              ))}
            </div>
            <textarea
              value={energyNote}
              onChange={(e) => setEnergyNote(e.target.value)}
              placeholder="补充一句（可选）：状态来自睡眠 / 咖啡 / 压力…"
              className="min-h-[64px] w-full resize-none rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:bg-surface"
            />
            <Button onClick={saveEnergy} disabled={energyLevel === null} className="self-end">
              <Zap className="size-4" /> 记录精力
            </Button>
            <p className="text-xs text-muted-foreground">
              只做个人行为统计，用于安排任务强度，不做医学判断。
            </p>
          </CardContent>
        </Card>

        {/* 休息与节奏 */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Coffee className="size-5 text-success" />
            <CardTitle>休息与节奏</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{today?.focusTodayMinutes ?? 0} 分钟</span>
                <span className="text-[11px] text-muted-foreground">今日专注</span>
              </div>
              {today?.nextBreakDue ? (
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                  建议休息一下
                </span>
              ) : (
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                  节奏良好
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {BREAK_PRESETS.map((b) => (
                <button
                  key={b.kind}
                  onClick={() => recordBreak(b.kind, b.minutes)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground transition-all hover:bg-muted/75"
                >
                  <b.icon className="size-3.5 text-success" /> {b.label} {b.minutes}′
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              {(today?.breaksToday ?? []).length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">今天还没有休息记录</p>
              ) : (
                today?.breaksToday.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Coffee className="size-3.5 text-success" /> {breakKindLabels[b.kind] ?? b.kind}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(b.startedAt).toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)} · {b.minutes} 分钟
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        {/* 今日运动（健康模块小类） */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-success" />
              <CardTitle>今日运动</CardTitle>
            </div>
            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
              今日 <span className="font-semibold">{exerciseToday?.totalMinutes ?? 0}</span>
              <span className="text-muted-foreground"> / {exerciseToday?.targetMinutes ?? 30}</span>
              <span className="text-muted-foreground"> 分钟</span>
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <Activity className="size-5 shrink-0 text-success" />
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold tabular-nums">
                    {exerciseToday?.totalMinutes ?? 0}
                    <span className="text-xs font-normal text-muted-foreground"> 分钟</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    目标 {exerciseToday?.targetMinutes ?? 30} 分钟 ·{' '}
                    {exerciseToday?.targetMinutes
                      ? Math.min(100, Math.round(((exerciseToday?.totalMinutes ?? 0) / exerciseToday.targetMinutes) * 100))
                      : 0}
                    %
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="progress-fill h-full rounded-full transition-all"
                    style={{
                      width: `${exerciseToday?.targetMinutes
                        ? Math.min(100, Math.round(((exerciseToday?.totalMinutes ?? 0) / exerciseToday.targetMinutes) * 100))
                        : 0}%`,
                    }}
                  />
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
                        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all",
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
                <span className="text-sm text-muted-foreground">分钟</span>
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
                  <span className="text-2xl font-bold tabular-nums">{timerText}</span>
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
              <p className="text-[11px] text-muted-foreground">
                专注运动倒计时，结束时自动记为「专注运动」；配合 {exMinutes || "—"} 分钟初始时长。
              </p>
            </div>

            {/* 今日运动记录 */}
            <div className="flex flex-col gap-1.5">
              {(exerciseToday?.logs ?? []).length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">今天还没有运动记录</p>
              ) : (
                exerciseToday?.logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Activity className="size-3.5 text-success" /> {l.typeLabel || exerciseTypeLabels[l.type]}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(l.startedAt).toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)} · {Math.round(l.durationSeconds / 60)} 分钟
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* 每日目标 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 今日建议（Today Engine） */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ListChecks className="size-5 text-primary" />
            <CardTitle>今日建议</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {plan.map((item, i) => {
              const meta = planKindMeta[item.kind];
              return (
                <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2.5">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                  >
                    <meta.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.time}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 提醒 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="size-5 text-primary" />
              <CardTitle>提醒</CardTitle>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowAddReminder((v) => !v)}>
              <Plus className="size-4" /> 添加提醒
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {reminders.length === 0 && !showAddReminder ? (
              <div className="flex flex-col gap-2 py-2">
                <p className="text-sm text-muted-foreground">还没有提醒，一键添加常用节奏：</p>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_PRESETS.map((p) => (
                    <button
                      key={p.type}
                      onClick={() => addReminderPreset(p)}
                      className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground transition-all hover:bg-muted/75"
                    >
                      {p.title} · 每 {p.intervalMinutes} 分钟
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {showAddReminder ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={rmType}
                    onChange={(e) => setRmType(e.target.value)}
                    className="paper-select h-10 rounded-xl px-3 text-sm outline-none"
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

            <div className="flex flex-col gap-2">
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                  <span className="icon-chip h-9 w-9 shrink-0">
                    <Bell className="size-4 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {reminderTypeLabels[r.type] ?? r.type} · 每 {r.intervalMinutes} 分钟 · {r.startTime}-{r.endTime}
                    </p>
                  </div>
                  <Switch checked={r.enabled} onCheckedChange={(v) => toggleReminder(r.id, v)} aria-label={`${r.title}开关`} />
                  <button
                    onClick={() => deleteReminder(r.id)}
                    aria-label="删除提醒"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
