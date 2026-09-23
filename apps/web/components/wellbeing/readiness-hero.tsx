"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DAILY_WEAKEST_LABEL, computeDailyReadiness, todayISO } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** 3D 状态球懒加载（ssr:false）：three 只在客户端进入时拉取，不进首包 */
const StateOrb = dynamic(() => import("@/components/three/state-orb").then((m) => m.StateOrb), {
  ssr: false,
  loading: () => <Skeleton className="size-[220px]" rounded="rounded-full" />,
});

interface DailyOs {
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number };
  fitness: {
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    nutritionRemainingKcal?: number;
  };
  hydration?: { totalMl: number; targetMl: number };
  habits: { scheduled: number; done: number };
}

const DIMS = [
  { key: "tasks", label: "任务", color: "#2f74c0", href: "/tasks" },
  { key: "habits", label: "习惯", color: "#8d7bd8", href: "/habits" },
  { key: "workout", label: "训练", color: "#e1781c", href: "/wellbeing/workout" },
  { key: "nutrition", label: "饮食", color: "#2fb3a6", href: "/wellbeing/nutrition" },
] as const;

/**
 * Web 健康页 hero（v8 P3）：3D 状态球 + 状态分 + 四项分解条 + 本周概览。
 *
 * 口径与 APP 完全一致（shared `computeDailyReadiness`）；数据全部复用现有接口，不新增后端。
 */
export function ReadinessHero() {
  const [daily, setDaily] = useState<DailyOs | null>(null);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [weekRows, setWeekRows] = useState<{ entryCount: number; kcal: number }[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [dailyRes, workoutRes, summaryRes] = await Promise.all([
          fetch(`/api/daily?date=${todayISO()}`),
          fetch("/api/workouts?days=7"),
          fetch("/api/nutrition/summary?days=7"),
        ]);
        if (!alive) return;
        if (dailyRes.ok) setDaily((await dailyRes.json()) as DailyOs);
        if (workoutRes.ok) {
          const d = (await workoutRes.json()) as { workouts?: unknown[] };
          setWeekWorkouts(Array.isArray(d.workouts) ? d.workouts.length : 0);
        }
        if (summaryRes.ok) {
          const d = (await summaryRes.json()) as { summary?: Record<string, { entryCount?: number; kcal?: number }> };
          setWeekRows(
            Object.values(d.summary ?? {}).map((r) => ({
              entryCount: Number(r?.entryCount ?? 0),
              kcal: Number(r?.kcal ?? 0),
            }))
          );
        }
      } catch {
        // 离线：保持占位（页面其余部分照常）
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const readiness = useMemo(
    () =>
      computeDailyReadiness({
        tasksTotal: daily?.learning.tasksTotal ?? 0,
        tasksDone: daily?.learning.tasksDone ?? 0,
        habitsScheduled: daily?.habits.scheduled ?? 0,
        habitsDone: daily?.habits.done ?? 0,
        workoutMinutes: daily?.fitness.workoutMinutes ?? 0,
        nutritionKcal: daily?.fitness.nutritionKcal ?? 0,
        nutritionTargetKcal: daily?.fitness.nutritionTargetKcal ?? 0,
      }),
    [daily]
  );

  const recordDays = weekRows.filter((r) => r.entryCount > 0).length;
  const avgKcal = recordDays > 0 ? Math.round(weekRows.reduce((s, r) => s + r.kcal, 0) / recordDays) : 0;

  return (
    <Card className="relative overflow-hidden border-white/20 bg-gradient-to-br from-primary/12 via-card/70 to-accent/12 shadow-[0_18px_60px_-30px_rgba(47,116,192,0.65)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-16 size-72 rounded-full bg-accent/15 blur-3xl" />
      <CardContent className="relative grid gap-7 p-6 lg:grid-cols-[248px_1fr] lg:p-8">
        <div className="flex flex-col items-center gap-2">
          <StateOrb score={readiness.score} size={220} />
          <div className="text-center">
            <div className="bg-gradient-to-r from-primary to-accent bg-clip-text text-5xl font-black tabular-nums text-transparent">
              {readiness.score}
            </div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">
              今日状态分 · {readiness.weakest ? DAILY_WEAKEST_LABEL[readiness.weakest] : readiness.verdict}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "本周训练", value: `${weekWorkouts}`, unit: "次" },
              { label: "饮食记录", value: recordDays > 0 ? `${recordDays}` : "--", unit: "天" },
              { label: "日均热量", value: avgKcal > 0 ? `${avgKcal}` : "--", unit: "kcal" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/15 bg-white/45 px-4 py-3 backdrop-blur-md dark:bg-white/5">
                <div className="text-[11px] font-medium text-muted-foreground">{s.label}</div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">
                  {s.value}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">{s.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">完成度分解</div>
            {DIMS.map((d) => {
              const pct = Math.round((readiness.parts[d.key] ?? 0) * 100);
              return (
                <Link
                  key={d.key}
                  href={d.href}
                  className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/40 dark:hover:bg-white/5"
                >
                  <span className="w-9 shrink-0 text-xs font-semibold text-muted-foreground">{d.label}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.max(2, pct)}%`, background: `linear-gradient(90deg, ${d.color}, ${d.color}cc)` }}
                    />
                  </span>
                  <span className={cn("w-10 shrink-0 text-right text-xs font-bold tabular-nums", pct >= 100 && "text-success")}>
                    {pct}%
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/wellbeing/nutrition" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.03]">记一条饮食</Link>
            <Link href="/wellbeing/workout" className="rounded-full border border-border/70 bg-card/60 px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted/60">记录训练</Link>
            <Link href="/today" className="rounded-full border border-border/70 bg-card/60 px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted/60">我的一天</Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
