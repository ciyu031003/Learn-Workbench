"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookOpen, Briefcase, Dumbbell, Repeat, CheckCircle2, Circle, Loader2,
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
      const r = await fetch("/api/daily");
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
    <div className="page-enter flex flex-col gap-6">
      {/* 问候 + 今日完成度 */}
      <div>
        <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">{data.greeting}</h1>
        <p className="page-subtitle mt-1 text-sm">今天 · {formatCN(data.date)}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">今日完成</span>
            <span className="text-2xl font-extrabold tabular-nums text-primary">{data.progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-strong transition-all"
              style={{ width: `${data.progress}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            学习任务 40% · 习惯 30% · 运动 15% · 饮食 15%
          </p>
        </CardContent>
      </Card>

      {/* 四个域 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {blocks.map((b) => (
          <Link key={b.key} href={b.href} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
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

      {/* 今日任务清单 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日任务</h2>
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
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
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
  );
}