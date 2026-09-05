"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { CareerReadiness, DashboardSummary, WellbeingToday } from "@learn-workbench/shared";
import { formatDuration, taskTypeLabels, formatDateCN, todayISO } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteWidget } from "@/components/quote-widget";
import { DomainIcon } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import { useToastStore } from "@/store/toast-store";
import { ExerciseSheet } from "@/components/sport/exercise-sheet";
import { Celebration } from "@/components/celebration";
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
  Pencil,
} from "lucide-react";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

/** 实时时钟（60s 刷新一次，够用可读） */
function LiveClock() {
  const [now, setNow] = useState(() => (typeof window === "undefined" ? null : new Date()));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return null;
  return (
    <span className="tabular-nums">
      {now.toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)}
    </span>
  );
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

/** 连续打卡火焰团：团簇越满代表连续天数越有积累感 */
function FlameCluster({ streak, className }: { streak: number; className?: string }) {
  const flameCount = Math.min(6, 1 + Math.floor(Math.max(0, streak) / 2));
  return (
    <span className={cn("flex items-end justify-center gap-0.5", className)} aria-label={`连续打卡 ${streak} 天`}>
      {Array.from({ length: flameCount }, (_, i) => (
        <Flame
          key={i}
          className={cn(
            "text-accent-strong",
            i === 0 ? "size-5" : i < 3 ? "size-4" : "size-3.5",
            i > 0 && "opacity-80"
          )}
          strokeWidth={2.2}
        />
      ))}
    </span>
  );
}

/** 整体进度环（SVG，CSS 过渡动画） */
function OverallRing({ percent }: { percent: number }) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, percent));
  return (
        <div className="ring-halo relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="hero-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2f74c0" />
            <stop offset="100%" stopColor="#5b93d6" />
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
  const [celebration, setCelebration] = useState<"sparkle" | "confetti" | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const domain = useDomainStore((s) => s.current);
  const pushToast = useToastStore((s) => s.push);

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
    const base = data?.todayTasks ?? [];
    const next = base.map((t) => (t.id === id ? { ...t, done } : t));
    setData((prev) => (prev ? { ...prev, todayTasks: next } : prev));
    if (done) {
      const allDone = next.every((t) => t.done);
      pushToast(allDone ? "今日任务全部完成！" : "任务完成，继续保持", "success");
      setCelebration(allDone ? "confetti" : "sparkle");
    }
    load();
  };

  const addQuickTask = async () => {
    const title = quickTitle.trim();
    if (!title || quickAdding) return;
    setQuickAdding(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDate: todayISO(),
          title,
          taskType: "study",
          phaseId: null,
          career: domain?.careerKey ?? "ict",
        }),
      });
      if (r.ok) {
        setQuickTitle("");
        pushToast(`已添加「${title}」`, "success");
        setCelebration("sparkle");
        load();
      }
    } catch {
      // 保留输入，交给用户重试
    } finally {
      setQuickAdding(false);
    }
  };

  const saveReview = async () => {
    const note = reviewNote.trim();
    if (!note || reviewSaving) return;
    setReviewSaving(true);
    try {
      const r = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (r.ok) {
        setReviewNote("");
        pushToast("今日复盘已记录", "success");
        setCelebration("sparkle");
        load();
      }
    } catch {
      // 保留输入，交给用户重试
    } finally {
      setReviewSaving(false);
    }
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
    { label: "连续打卡", value: `${data?.streak ?? 0} 天`, icon: Flame, accent: "text-accent-strong", href: "/logs", flame: true },
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
      <section
        className={`paper-card glow-border relative overflow-hidden ${
          mounted
            ? new Date().getHours() < 11
              ? "glow-morning"
              : new Date().getHours() < 17
                ? "glow-noon"
                : "glow-evening"
            : "glow-noon"
        }`}
      >
        <div className="ambient-glow" aria-hidden="true" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)_minmax(160px,200px)] lg:items-center lg:gap-7 lg:p-7">
          <div className="min-w-0">
            <p className="page-subtitle flex items-center gap-2 text-xs">
              {mounted ? formatDateCN(today) : "今日"}
              <span className="text-muted-foreground/50">·</span>
              <LiveClock />
            </p>
            <h1 className="page-title mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {mounted ? `${greet}，${data?.careerName ?? "ICT 学习规划"}` : `你好，${data?.careerName ?? "ICT 学习规划"}`}
            </h1>
            <p className="page-subtitle mt-1.5 text-sm">把最重要的一件事做完，就赢了一半。</p>
            {domain ? (
              <Link
                href="/roadmap"
                className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
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
          <QuoteWidget variant="inline" className="min-w-0" />
          <div className="flex items-center justify-center">
            <OverallRing percent={data?.overallPercent ?? 0} />
          </div>
        </div>
      </section>

      {/* 快捷开始：一键学习 / 一键运动 */}
      <section aria-label="快捷开始">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/tasks?autofocus=study&minutes=25" className="group">
            <Card className="hover-glow-primary paper-hover press-scale h-full">
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
          <button type="button" onClick={() => setSportSheetOpen(true)} className="group text-left">
            <Card className="hover-glow-accent paper-hover press-scale h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="icon-chip h-10 w-10 shrink-0">
                  <Dumbbell className="size-5 text-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">开始运动</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">篮球 · 羽毛球 · 跑步 · 深蹲… 30+ 项目任选</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </button>
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
                    今日焦点 · 正在进行的任务
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
              <Button onClick={checkin} variant="ghost" size="sm" className="cta-breathe press-scale">
                <Flame className="size-4 text-accent-strong" /> 今日打卡
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((c) => (
            <Link key={c.label} href={c.href} className="group">
              <Card className="press-scale">
                <CardContent className="flex flex-col gap-2 p-4">
                  {c.flame ? (
                    <FlameCluster streak={data?.streak ?? 0} />
                  ) : (
                    <span className={cn("icon-chip h-9 w-9 shrink-0", c.accent)}>
                      <c.icon className="size-4.5" />
                    </span>
                  )}
                  <StatValue value={c.value} className="text-xl" />
                  <span className="text-[11px] text-muted-foreground">{c.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* 健康快照（跳转 wellbeing） */}
        <Link href="/wellbeing" className="group mt-3 block">
          <Card className="paper-hover">
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
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveReview();
          }}
        >
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success-strong sm:flex">
            <Pencil className="size-4" />
          </span>
          <Input
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="一句话复盘：今天最重要的收获 / 明天要改进的一点"
            className="h-9 flex-1"
            aria-label="今日一句话复盘"
          />
          <Button type="submit" size="sm" disabled={!reviewNote.trim() || reviewSaving} className="press-scale">
            {reviewSaving ? "保存中…" : "记一句"}
          </Button>
        </form>
      
      {/* 今日运动项目 chips */}
      {wellbeing && wellbeing.exercise.logs.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">今日运动</span>
          {wellbeing.exercise.logs.slice(-6).map((log) => (
            <span
              key={log.id}
              className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
            >
              {log.typeLabel ?? "运动"} · {Math.max(1, Math.round(log.durationSeconds / 60))}分
            </span>
          ))}
        </div>
      ) : null}
      </section>

      {/* ③ 接下来 */}
      <section>
        <SectionTitle
          icon={TrendingUp}
          title="接下来"
          action={
            <div className="flex items-center gap-1.5">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/tasks">
                  全部 <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          }
        />
        <form
          className="mb-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addQuickTask();
          }}
        >
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-strong sm:flex">
            <Plus className="size-4" />
          </span>
          <Input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="快速添加一个今日任务，回车即创建"
            className="h-9"
            aria-label="快速添加今日任务"
          />
          <Button type="submit" size="sm" disabled={!quickTitle.trim() || quickAdding} className="press-scale">
            {quickAdding ? "添加中…" : "添加"}
          </Button>
        </form>
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
                className="rise-in flex items-center gap-3 rounded-xl border border-border bg-muted/35 px-3.5 py-3"
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

      <ExerciseSheet
        open={sportSheetOpen}
        onClose={() => setSportSheetOpen(false)}
        onLogged={() => {
          load();
          fetch("/api/wellbeing/today")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setWellbeing(d))
            .catch(() => {});
        }}
      />
      {celebration ? (
        <Celebration
          kind={celebration}
          message={celebration === "confetti" ? "今日任务全部完成！" : "任务完成"}
          onDone={() => setCelebration(null)}
        />
      ) : null}

    </div>
  );
}
