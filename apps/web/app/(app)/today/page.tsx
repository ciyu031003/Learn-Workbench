"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { todayISO } from "@learn-workbench/shared/dates";
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
      <div className="page-enter flex items-center justify-center py-24 text-body-medium text-text-secondary">
        <Loader2 className="mr-2 size-4 animate-spin" /> 正在汇总今天…
      </div>
    );
  }

  if (!data) {
    return (
      <section className="rounded-3xl border border-border-button-default bg-background-secondary-default p-6 text-body-medium text-text-secondary">
        暂时无法加载「我的一天」
      </section>
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
    <div className="page-enter">
      <div className="lwb-stagger flex flex-col gap-5">
        {/* 问候 + 今日日期 */}
        <PageHeader title={data.greeting} description={`今天 · ${formatCN(data.date)}`} />

        {/* 完成度球 + 四个域入口：3 列网格，球独占一列，域入口 2×2 */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="flex min-w-0 flex-col items-center justify-center gap-4 rounded-2xl border border-border-button-default bg-background-secondary-default p-5">
            <div className="relative flex size-40 items-center justify-center">
              <svg viewBox="0 0 160 160" className="size-40 -rotate-90" role="img" aria-label="今日完成度">
                <circle cx="80" cy="80" r="66" fill="none" stroke="var(--color-border-button-default)" strokeWidth="10" />
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 66}
                  strokeDashoffset={2 * Math.PI * 66 * (1 - Math.max(0, Math.min(100, data.progress)) / 100)}
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-display-3-semibold tabular-nums text-text-primary">{data.progress}%</span>
                <span className="text-caption-1-medium text-text-secondary">今日完成</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-caption-1-medium text-text-secondary">
                今日完成度 · 学习 40% · 习惯 30% · 运动 15% · 饮食 15%
              </p>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {blocks.map((b) => (
              <Link key={b.key} href={b.href} className="group min-w-0">
                <section className="flex h-full min-w-0 items-center gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4 transition-colors group-hover:bg-background-secondary-default">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background-tertiary-default">
                    <b.icon className="size-5 text-foreground-icon-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline-medium text-text-primary">{b.label}</p>
                    <p className="truncate text-body-2-regular text-text-secondary">{b.detail}</p>
                  </div>
                  {b.extra ? <Badge variant="muted">{b.extra}</Badge> : null}
                  <ArrowRight className="size-4 shrink-0 text-foreground-icon-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                </section>
              </Link>
            ))}
          </div>
        </div>

        {/* 今日任务（卡内滚动）+ 饮食与提醒：2 列，页面不再纵向拉长 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default lg:h-[340px]">
            <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-primary-default">
                <BookOpen className="size-4 text-foreground-icon-secondary" />
              </span>
              <h2 className="min-w-0 truncate text-headline-medium text-text-primary">今日任务</h2>
              <Button size="sm" variant="ghost" asChild className="ms-auto shrink-0">
                <Link href="/tasks">全部任务 <ArrowRight className="size-3.5" /></Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 px-5 pb-4">
              {data.learning.items.length === 0 ? (
                <p className="py-6 text-center text-body-medium text-text-secondary">今天还没有任务</p>
              ) : (
                <ScrollFade className="h-full">
                  <div className="flex flex-col gap-1 pe-1">
                    {data.learning.items.map((t) => (
                      <Link
                        key={t.id}
                        href="/tasks"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-background-secondary-hover"
                      >
                        {t.done ? (
                          // v13 U8：勾选描边绘制（技法参考 uiverse.io/JkHuger/warm-panther-74, MIT）
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            className="check-draw size-4 shrink-0 text-success-strong"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M8 12.4l2.7 2.7L16.4 9.4" />
                          </svg>
                        ) : (
                          <Circle className="size-4 shrink-0 text-foreground-icon-tertiary" />
                        )}
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-body-medium text-text-primary",
                            t.done && "text-text-tertiary line-through"
                          )}
                        >
                          {t.title}
                        </span>
                        <Badge variant="outline">{t.careerKey}</Badge>
                      </Link>
                    ))}
                  </div>
                </ScrollFade>
              )}
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-3">
            <SectionLabel>饮食与提醒</SectionLabel>
            <section className="flex min-w-0 items-center gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
              <Salad className="size-5 shrink-0 text-foreground-icon-primary" />
              <div className="min-w-0">
                <p className="text-headline-medium text-text-primary">
                  {data.fitness.nutritionKcal} / {data.fitness.nutritionTargetKcal} kcal
                </p>
                <p className="text-caption-1-regular text-text-secondary">今日饮食</p>
              </div>
              <Button size="sm" variant="ghost" className="ms-auto" asChild>
                <Link href="/wellbeing/nutrition">记录</Link>
              </Button>
            </section>

            <section className="flex min-w-0 items-center gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
              <Target className="size-5 shrink-0 text-foreground-icon-primary" />
              <div className="min-w-0">
                <p className="text-headline-medium text-text-primary">
                  {data.career.expiringCertificates > 0 ? `${data.career.expiringCertificates} 张证书临近有效期` : "证书状态正常"}
                </p>
                <p className="text-caption-1-regular text-text-secondary">证书提醒（30 天内到期）</p>
              </div>
              <Button size="sm" variant="ghost" className="ms-auto" asChild>
                <Link href="/career/certificates">查看</Link>
              </Button>
            </section>

            {data.habits.scheduled > 0 && data.habits.done < data.habits.scheduled ? (
              <section className="flex min-w-0 items-center gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
                <Flame className="size-5 shrink-0 text-status-orange-text" />
                <p className="min-w-0 text-body-medium text-text-primary">
                  还有 <span className="font-semibold">{data.habits.scheduled - data.habits.done}</span> 个习惯待打卡
                </p>
                <Button size="sm" className="ms-auto" asChild>
                  <Link href="/habits">去打卡</Link>
                </Button>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
