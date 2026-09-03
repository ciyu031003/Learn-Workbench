"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { CareerReadiness, DashboardSummary, WellbeingToday } from "@learn-workbench/shared";
import { formatDuration, taskTypeLabels, formatDateCN } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuoteWidget } from "@/components/quote-widget";
import { DomainIcon } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import { cn } from "@/lib/utils";
import {
  Target,
  Activity,
  TrendingUp,
  Rocket,
  ListTodo,
  Clock3,
  CheckCircle2,
  Circle,
  ArrowRight,
  Play,
  Droplets,
  Zap,
  Flame,
  Plus,
  BookOpen,
  Dumbbell,
} from "lucide-react";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

/** 数字 count-up（尊重 prefers-reduced-motion） */
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => {
        setValue(target);
        fromRef.current = target;
      });
      return () => cancelAnimationFrame(raf);
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * eased);
      setValue(v);
      fromRef.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatValue({ value, className }: { value: number | string; className?: string }) {
  const s = String(value);
  const m = /^(-?[\d.]+)(.*)$/.exec(s);
  const target = m ? Number(m[1]) : NaN;
  const animated = useCountUp(Number.isFinite(target) ? target : 0);
  const text = Number.isFinite(target) ? animated + (m?.[2] ?? "") : s;
  return <span className={cn("stat-pop font-bold tabular-nums tracking-tight", className)}>{text}</span>;
}

/** 整体进度环（SVG，CSS 过渡动画） */
function OverallRing({ percent }: { percent: number }) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="hero-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
        <circle
          cx="75"
          cy="75"
          r={R}
          fill="none"
          stroke="url(#hero-ring-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <StatValue value={p + "%"} className="text-2xl" />
        <span className="text-[11px] text-muted-foreground">整体进度</span>
      </div>
    </div>
  );
}

/** 小节标题 */
function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Target;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="icon-chip h-8 w-8 shrink-0">
          <Icon className="size-4 text-primary" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wellbeing, setWellbeing] = useState<WellbeingToday | null>(null);
  const [mounted, setMounted] = useState(false);
  const domain = useDomainStore((s) => s.current);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard");
      if (!r.ok) throw new Error("load failed");
      const d = await r.json();
      setData(d.summary ?? null);
      setReadiness(d.readiness ?? null);
      setError(null);
    } catch {
      setError("数据库暂不可用，请确认已运行 scripts\\start_pg.ps1 启动本地 PostgreSQL");
    }
  }, []);

  // 客户端挂载后重算时间相关问候/日期（避免 SSR 静态快照与水合时间不一致）
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    // 数据加载：异步拉取外部系统后 setState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // 今日状态（Wellbeing MVP）
  useEffect(() => {
    let alive = true;
    fetch("/api/wellbeing/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setWellbeing(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const checkin = async () => {
    await fetch("/api/checkin", { method: "POST", body: JSON.stringify({}) });
    load();
  };

  const toggleDone = async (id: number, done: boolean) => {
    await fetch("/api/tasks", { method: "PATCH", body: JSON.stringify({ id, done }) });
    load();
  };

  const today = mounted ? new Date().toISOString().slice(0, 10) : "";
  const greet = mounted ? greeting() : "";

  const tasks = data?.todayTasks ?? [];
  const todayCount = tasks.length;
  const todayDone = tasks.filter((t) => t.done).length;
  const undone = [...tasks].filter((t) => !t.done).sort((a, b) => a.sortOrder - b.sortOrder);
  const currentTask = undone[0] ?? null;
  const upcoming = undone.slice(1, 5);

  const statCards = [
    { label: "职业准备度", value: `${readiness?.overall ?? 0}%`, icon: Rocket, accent: "text-accent", href: "/career" },
    { label: "今日任务", value: `${todayDone}/${todayCount}`, icon: ListTodo, accent: "text-success", href: "/tasks" },
    { label: "本周专注", value: formatDuration(data?.totalFocusMinutes ?? 0), icon: Clock3, accent: "text-warning", href: "/tasks#focus" },
    { label: "连续打卡", value: `${data?.streak ?? 0} 天`, icon: Flame, accent: "text-orange-500", href: "/logs" },
  ];

  const wellbeingChips = [
    { label: "精力", value: wellbeing?.energy ? `${wellbeing.energy.level}/5` : "待记录", icon: Zap, accent: "text-warning" },
    { label: "饮水", value: wellbeing ? `${wellbeing.hydration.totalMl}ml` : "—", icon: Droplets, accent: "text-accent" },
    { label: "运动", value: wellbeing ? `${wellbeing.exercise.totalMinutes} 分` : "—", icon: Activity, accent: "text-success" },
  ];

  return (
    <div className="page-enter flex flex-col gap-6">
      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      {/* 问候条 + 整体进度 */}
      <section className="glass relative overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
          <div className="min-w-0">
            <p className="page-subtitle text-xs">{mounted ? formatDateCN(today) : "今日"}</p>
            <h1 className="page-title mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {mounted ? `${greet}，${data?.careerName ?? "ICT 学习规划"}` : `你好，${data?.careerName ?? "ICT 学习规划"}`}
            </h1>
            <p className="page-subtitle mt-1.5 text-sm">把最重要的一件事做完，就赢了一半。</p>
            {domain ? (
              <Link
                href="/roadmap"
                className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl backdrop-saturate-150 transition-colors hover:bg-white/18"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${domain.color}26`, color: domain.color }}
                >
                  <DomainIcon icon={domain.icon} className="size-3.5" />
                </span>
                <span className="max-w-44 truncate">{domain.name}</span>
                {domain.kindLabel ? <span className="text-muted-foreground">· {domain.kindLabel}</span> : null}
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ) : null}
          </div>
          <div className="shrink-0">
            <OverallRing percent={data?.overallPercent ?? 0} />
          </div>
        </div>
      </section>

      {/* 快捷开始：一键学习 / 一键运动 */}
      <section aria-label="快捷开始">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/tasks?autofocus=study&minutes=25" className="group">
            <Card className="glass-hover press-scale h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="icon-chip h-10 w-10 shrink-0">
                  <BookOpen className="size-5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">一键学习</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">25 分钟专注 · 立即开始</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/tasks?autofocus=exercise&minutes=30" className="group">
            <Card className="glass-hover press-scale h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="icon-chip h-10 w-10 shrink-0">
                  <Dumbbell className="size-5 text-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">一键运动</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">30 分钟计时 · 立即开始</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* ① 当前任务 */}
      <section>
        <SectionTitle
          icon={Target}
          title="当前任务"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">
                今日任务 <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6">
            {currentTask ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-medium text-primary">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    正在进行的任务
                  </span>
                  <Badge variant="muted">今日 {todayDone}/{todayCount}</Badge>
                </div>
                <div className="flex flex-col gap-2.5">
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{currentTask.title}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{taskTypeLabels[currentTask.taskType] ?? currentTask.taskType}</Badge>
                    {currentTask.phaseId ? <Badge variant="muted">路线图阶段</Badge> : null}
                    {currentTask.focusMinutes > 0 ? (
                      <Badge variant="accent">已专注 {currentTask.focusMinutes} 分</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="lg" className="press-scale">
                    <Link href="/tasks#focus">
                      <Play className="size-4" /> 开始专注
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg" className="press-scale">
                    <Link href="/tasks">
                      去今日任务 <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-start gap-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-6 text-success" />
                  <p className="text-lg font-semibold text-success">
                    {todayCount === 0 ? "今天还没安排任务" : "今日任务已全部完成"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {todayCount === 0 ? "先规划一个今日要完成的小目标，或者去路线图推进下一阶段。" : "可以去复盘，或提前看明天的安排。"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary" className="press-scale">
                    <Link href="/tasks">
                      <Plus className="size-4" /> {todayCount === 0 ? "添加任务" : "看任务"}
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="press-scale">
                    <Link href="/roadmap">
                      去路线图 <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ② 当前状态 */}
      <section>
        <SectionTitle
          icon={Activity}
          title="当前状态"
          action={
            <div className="flex items-center gap-1.5">
              <Button onClick={checkin} variant="ghost" size="sm" className="press-scale">
                <Flame className="size-4 text-orange-500" /> 今日打卡
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((c) => (
            <Link key={c.label} href={c.href} className="group">
              <Card className="press-scale">
                <CardContent className="flex flex-col gap-2 p-4">
                  <span className={cn("icon-chip h-9 w-9 shrink-0", c.accent)}>
                    <c.icon className="size-4.5" />
                  </span>
                  <StatValue value={c.value} className="text-xl" />
                  <span className="text-[11px] text-muted-foreground">{c.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* 健康快照（跳转 wellbeing） */}
        <Link href="/wellbeing" className="group mt-3 block">
          <Card className="glass-hover">
            <CardContent className="grid grid-cols-3 gap-3 p-4">
              {wellbeingChips.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5">
                  <span className="icon-chip h-9 w-9 shrink-0">
                    <c.icon className={cn("size-4", c.accent)} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tabular-nums">{c.value}</p>
                    <p className="text-[11px] text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              ))}
              <span className="hidden items-center justify-end text-xs text-muted-foreground group-hover:block sm:flex">
                <ArrowRight className="size-4" />
              </span>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* ③ 接下来 */}
      <section>
        <SectionTitle
          icon={TrendingUp}
          title="接下来"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">
                全部 <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <p className="text-sm text-muted-foreground">
                {undone.length === 0
                  ? "今天没有更多待办任务了，去添加或规划一下吧。"
                  : "只剩一个任务了，先专注搞定它！"}
              </p>
              <Button asChild variant="secondary" size="sm" className="press-scale">
                <Link href="/tasks">
                  <Plus className="size-4" /> 添加任务
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((t, i) => (
              <div
                key={t.id}
                className="rise-in flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3.5 py-3 backdrop-blur-md"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <button
                  onClick={() => toggleDone(t.id, true)}
                  aria-label="标记完成"
                  className="shrink-0 rounded-lg p-1 text-muted-foreground/40 transition-all hover:text-success"
                >
                  <Circle className="size-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <Badge variant="muted" className="mt-1">
                    {taskTypeLabels[t.taskType] ?? t.taskType}
                  </Badge>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href="/tasks#focus">
                    <Play className="size-3.5" /> 专注
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 每日一言（轻量收尾） */}
      <QuoteWidget className="mt-1" />
    </div>
  );
}