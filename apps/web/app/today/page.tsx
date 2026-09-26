"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

/** 3D 完成度球（懒加载，ssr:false；three 只在客户端进入时拉取） */
const StateOrb = dynamic(() => import("@/components/three/state-orb").then((m) => m.StateOrb), {
  ssr: false,
  loading: () => <Skeleton className="size-[208px]" rounded="rounded-full" />,
});
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { todayISO } from "@learn-workbench/shared";
import { cn } from "@/lib/utils";
import {
  BookOpen, Briefcase, Dumbbell, Repeat, Circle, Loader2,
  ArrowRight, Flame, Target, Salad,
} from "lucide-react";

interface DailyOs {
  date: string;
  greeting: string;
  progress: number;
  learning: {
    tasksTotal: number;
    tasksDone: number;
    focusMinutes: number;
    items: { id: number; title: string; done: boolean; taskType: string; careerKey: string }[];
  };
  career: { targetRole: string | null; highMatchJobs: number; pendingApplications: number; expiringCertificates: number };
  fitness: { workoutName: string | null; workoutMinutes: number; nutritionKcal: number; nutritionTargetKcal: number };
  habits: { scheduled: number; done: number };
}

function formatCN(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  void y;
  return `${m}月${d}日`;
}

export default function TodayPage() {
  const [data, setData] = useState<DailyOs | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/daily?date=${todayISO()}`);
      if (r.ok) setData(await r.json());
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="page-enter flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> 正在汇总今天…
      </div>
    );
  }

  if (!data) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载「我的一天」</CardContent></Card>
    );
  }

  const blocks = [
    {
      key: "learning",
      icon: BookOpen,
      label: "学习",
      detail: data.learning.tasksTotal > 0
        ? `${data.learning.tasksDone}/${data.learning.tasksTotal} 个任务 · 专注 ${data.learning.focusMinutes} 分钟`
        : `专注 ${data.learning.focusMinutes} 分钟`,
      href: "/tasks",
    },
    {
      key: "career",
      icon: Briefcase,
      label: "职业",
      detail: data.career.targetRole
        ? `${data.career.targetRole} · 高匹配 ${data.career.highMatchJobs} 个岗位`
        : `高匹配 ${data.career.highMatchJobs} 个岗位`,
      href: "/career/radar",
      extra: data.career.pendingApplications > 0 ? `在途投递 ${data.career.pendingApplications}` : null,
    },
    {
      key: "fitness",
      icon: Dumbbell,
      label: "运动",
      detail: data.fitness.workoutName
        ? `${data.fitness.workoutName} · ${data.fitness.workoutMinutes} 分钟`
        : "今天还没有训练",
      href: "/wellbeing/workout",
    },
    {
      key: "habits",
      icon: Repeat,
      label: "习惯",
      detail: data.habits.scheduled > 0
        ? `${data.habits.done}/${data.habits.scheduled} 已完成`
        : "今天没有排期习惯",
      href: "/habits",
    },
  ];

  return (
    <div className="page-enter relative">
      {/* 流动呼吸光效层（与移动端流光呼应；减弱动态时静止） */}
      <div className="lwb-page-aurora" aria-hidden>
        <span className="lwb-page-orb lwb-page-orb-a" />
        <span className="lwb-page-orb lwb-page-orb-b" />
        <span className="lwb-page-orb lwb-page-orb-c" />
      </div>
      <div className="lwb-stagger relative z-[1] flex flex-col gap-6">
      {/* 问候 + 今日完成度 */}
      <div>
        <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">{data.greeting}</h1>
        <p className="page-subtitle mt-1 text-sm">今天 · {formatCN(data.date)}</p>
      </div>

      {/* v8：3D 完成度球 hero（今日页的视觉主角）+ 四个域入口 */}
      <Card className="lwb-sheen relative overflow-hidden border-white/20 bg-gradient-to-br from-primary/12 via-card/70 to-accent/12 shadow-[0_18px_60px_-30px_rgba(47,116,192,0.65)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-16 size-72 rounded-full bg-accent/15 blur-3xl" />
        {/* v13 U12：低透明度几何底纹（技法参考 uiverse.io/csemszepp/old-hound-37, MIT），只做氛围 */}
        <div
          aria-hidden
          className="pattern-bauhaus pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(120deg,black,transparent_65%)]"
        />
        <CardContent className="relative grid gap-7 p-6 lg:grid-cols-[236px_1fr] lg:p-8">
          <div className="flex flex-col items-center gap-2">
            <StateOrb score={data.progress} size={208} />
            <div className="text-center">
              <div className="bg-gradient-to-r from-primary to-accent bg-clip-text text-5xl font-black tabular-nums text-transparent">
                {data.progress}%
              </div>
              <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                今日完成度 · 学习 40% · 习惯 30% · 运动 15% · 饮食 15%
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {blocks.map((b) => (
              <Link key={b.key} href={b.href} className="group">
                <Card className="lwb-lift h-full border-white/15 bg-white/45 backdrop-blur-md transition-all group-hover:-translate-y-0.5 group-hover:bg-white/60 dark:bg-white/5 dark:group-hover:bg-white/10">
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                      <b.icon className="size-5 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{b.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.detail}</p>
                    </div>
                    {b.extra ? <Badge variant="muted">{b.extra}</Badge> : null}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 今日任务清单 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>今日任务</SectionLabel>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/tasks">全部任务 <ArrowRight className="size-3.5" /></Link>
          </Button>
        </div>
        {data.learning.items.length === 0 ? (
          <Card><CardContent className="p-5 text-sm text-muted-foreground">今天还没有任务</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col divide-y divide-border/50 p-2">
              {data.learning.items.map((t) => (
                <Link key={t.id} href="/tasks" className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                  {t.done ? (
                    // v13 U8：勾选描边绘制（技法参考 uiverse.io/JkHuger/warm-panther-74, MIT）
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className="check-draw size-4 shrink-0 text-success"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 12.4l2.7 2.7L16.4 9.4" />
                    </svg>
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn("min-w-0 flex-1 truncate text-sm", t.done && "text-muted-foreground line-through")}>
                    {t.title}
                  </span>
                  <Badge variant="outline">{t.careerKey}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* 饮食与提醒 */}
      <SectionLabel>饮食与提醒</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Salad className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {data.fitness.nutritionKcal} / {data.fitness.nutritionTargetKcal} kcal
              </p>
              <p className="text-[11px] text-muted-foreground">今日饮食</p>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" asChild>
              <Link href="/wellbeing/nutrition">记录</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Target className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {data.career.expiringCertificates > 0 ? `${data.career.expiringCertificates} 张证书临近有效期` : "证书状态正常"}
              </p>
              <p className="text-[11px] text-muted-foreground">证书提醒（30 天内到期）</p>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" asChild>
              <Link href="/career/certificates">查看</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {data.habits.scheduled > 0 && data.habits.done < data.habits.scheduled ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Flame className="size-5 shrink-0 text-warning" />
            <p className="text-sm">
              还有 <span className="font-semibold">{data.habits.scheduled - data.habits.done}</span> 个习惯待打卡
            </p>
            <Button size="sm" className="ml-auto" asChild>
              <Link href="/habits">去打卡</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      </div>
    </div>
  );
}