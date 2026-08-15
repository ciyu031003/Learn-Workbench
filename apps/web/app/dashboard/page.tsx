"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardSummary } from "@learn-workbench/shared";
import { formatDuration, taskTypeLabels, formatDateCN } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { QuoteWidget } from "@/components/quote-widget";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  Flame,
  Clock3,
  CheckCircle2,
  ChevronRight,
  Award,
  Map,
  ListTodo,
  NotebookPen,
  Sparkles,
  FolderGit2,
  Plus,
  Trash2,
  ExternalLink,
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

function StatValue({ value, className }: { value: string; className?: string }) {
  const m = /^(-?[\d.]+)(.*)$/.exec(value);
  const target = m ? Number(m[1]) : NaN;
  const animated = useCountUp(Number.isFinite(target) ? target : 0);
  const text = Number.isFinite(target) ? animated + (m?.[2] ?? "") : value;
  return <span className={cn("font-bold tabular-nums tracking-tight", className)}>{text}</span>;
}

/** 整体进度环（SVG，CSS 过渡动画） */
function OverallRing({ percent }: { percent: number }) {
  const R = 62;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative h-36 w-36 shrink-0">
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
        <StatValue value={p + "%"} className="text-3xl" />
        <span className="text-[11px] text-muted-foreground">整体进度</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [github, setGithub] = useState<{ id: number; title: string; url: string | null; content: string | null }[]>([]);
  const [ghTitle, setGhTitle] = useState("");
  const [ghUrl, setGhUrl] = useState("");
  const [ghDesc, setGhDesc] = useState("");
  const ghTitleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/summary");
      if (!r.ok) throw new Error("load failed");
      setData(await r.json());
      setError(null);
    } catch {
      setError("数据库暂不可用，请确认已运行 scripts\\start_pg.ps1 启动本地 PostgreSQL");
    }
  }, []);

  useEffect(() => {
    // 数据加载：异步拉取外部系统后 setState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const loadGithub = useCallback(async () => {
    try {
      const r = await fetch("/api/github");
      if (r.ok) setGithub((await r.json()).records ?? []);
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGithub();
  }, [loadGithub]);

  const addGithub = async () => {
    if (!ghTitle.trim()) return;
    const r = await fetch("/api/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: ghTitle.trim(), url: ghUrl.trim() || null, content: ghDesc.trim() || null }),
    });
    if (r.ok) {
      setGhTitle("");
      setGhUrl("");
      setGhDesc("");
      loadGithub();
    }
  };

  const deleteGithub = async (id: number) => {
    await fetch(`/api/github?id=${id}`, { method: "DELETE" });
    loadGithub();
  };

  const checkin = async () => {
    await fetch("/api/checkin", { method: "POST", body: JSON.stringify({}) });
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  const mainPhases = data?.phases.filter((p) => p.track === "main") ?? [];
  const agentPhases = data?.phases.filter((p) => p.track === "agent") ?? [];

  return (
    <div className="page-enter flex flex-col gap-6">
      {/* 晨间驾驶舱：问候 + 整体进度环 + 今日聚焦 */}
      <Card className="relative overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
          <div className="min-w-0">
            <h1 className="page-title text-3xl font-bold tracking-tight lg:text-5xl">
              {greeting()}，继续今天的 {data?.careerName ?? "ICT 学习规划"}
            </h1>
            <p className="page-subtitle mt-2 text-sm">
              {formatDateCN(today)} · 当前职业路线：{data?.careerName ?? "ICT 学习规划"}
            </p>
            <QuoteWidget className="mt-5 w-full max-w-md" />
          </div>

          <div className="flex items-center gap-5 lg:gap-8">
            <OverallRing percent={data?.overallPercent ?? 0} />
            <div className="flex flex-col gap-2.5">
              {[
                { label: "今日任务", value: data ? `${data.weekTaskDone}/${data.weekTaskCount}` : "—", icon: ListTodo, accent: "text-success" },
                { label: "本周专注", value: data ? formatDuration(data.totalFocusMinutes) : "—", icon: Clock3, accent: "text-accent" },
                { label: "连续打卡", value: data ? `${data.streak} 天` : "—", icon: Flame, accent: "text-orange-500" },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-md">
                  <p.icon className={`size-4 shrink-0 ${p.accent}`} />
                  <div className="flex min-w-0 flex-col">
                    <StatValue value={p.value} className="text-sm" />
                    <span className="text-[11px] text-muted-foreground">{p.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 整体进度 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>各阶段进度 · {data?.careerName ?? "ICT"}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/roadmap">
                路线图 <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {mainPhases.slice(0, 3).map((p) => (
                <div key={p.phaseId}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{p.title}</span>
                    <span className="text-muted-foreground">{p.done}/{p.total}</span>
                  </div>
                  <Progress value={p.percent} />
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {mainPhases.map((p) => (
                <div key={p.phaseId} className="rounded-xl bg-muted/60 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{p.title}</span>
                    <span className="ml-2 shrink-0 text-muted-foreground">{p.percent}%</span>
                  </div>
                  <Progress value={p.percent} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 今日任务 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>今日任务</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">
                全部 <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <Button onClick={checkin} variant="secondary" className="w-full justify-start gap-2">
              <Flame className="size-4 text-orange-500" /> 今日打卡
            </Button>
            {data?.todayTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">今天还没有任务，去添加一个吧</p>
            ) : (
              data?.todayTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
                  <CheckCircle2 className={`size-5 shrink-0 ${t.done ? "text-success" : "text-muted-foreground/40"}`} />
                  <span className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                  <Badge variant="muted">{taskTypeLabels[t.taskType] ?? t.taskType}</Badge>
                </div>
              ))
            )}
            <div className="mt-1 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              本周完成 {data?.weekTaskDone ?? 0}/{data?.weekTaskCount ?? 0} · 日志 {data?.logsThisWeek ?? 0} 篇
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 证书 */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Award className="size-5 text-primary" />
            <CardTitle>证书冲刺</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {data?.certificates.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">暂无证书计划（P1 支持证书倒计时）</p>
            ) : (
              data?.certificates.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant={c.status === "achieved" ? "success" : "default"}>
                    {c.status === "achieved" ? "已取得" : c.targetDate ?? "规划中"}
                  </Badge>
                </div>
              ))
            )}
            <p className="mt-1 text-xs text-muted-foreground">HCIP-Datacom · 天翼云 ACP</p>
          </CardContent>
        </Card>

        {/* Agent 副线 */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            <CardTitle>Agent 应用副线</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {agentPhases.map((p) => (
              <div key={p.phaseId}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-muted-foreground">{p.done}/{p.total}</span>
                </div>
                <Progress value={p.percent} indicatorClassName="progress-fill-accent" />
              </div>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">Prompt → 工具 → RAG → 编排 → MCP → 工程化</p>
          </CardContent>
        </Card>

        {/* 快捷入口 */}
        <Card>
          <CardHeader>
            <CardTitle>快捷入口</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="secondary" className="justify-start">
              <Link href="/roadmap"><Map className="size-4" /> 路线图</Link>
            </Button>
            <Button asChild variant="secondary" className="justify-start">
              <Link href="/tasks"><ListTodo className="size-4" /> 今日任务与专注</Link>
            </Button>
            <Button asChild variant="secondary" className="justify-start">
              <Link href="/logs"><NotebookPen className="size-4" /> 费曼 / 复盘日志</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* GitHub 记录 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="size-5 text-foreground" />
            <CardTitle>GitHub 记录</CardTitle>
          </div>
          <Badge variant="muted">{github.length} 条</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              ref={ghTitleRef}
              value={ghTitle}
              onChange={(e) => setGhTitle(e.target.value)}
              placeholder="项目 / 仓库名称（必填）"
              className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
            />
            <input
              value={ghUrl}
              onChange={(e) => setGhUrl(e.target.value)}
              placeholder="GitHub 链接（可选）"
              className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
            />
            <input
              value={ghDesc}
              onChange={(e) => setGhDesc(e.target.value)}
              placeholder="一句话说明（可选）"
              className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
            />
          </div>
          <Button onClick={addGithub} disabled={!ghTitle.trim()} className="self-end">
            <Plus className="size-4" /> 添加记录
          </Button>

          {github.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="还没有 GitHub 记录"
              hint="把做过的项目沉淀成资产：网络巡检助手 / 数仓 ETL / ICT 交付助手…"
              action={
                <Button size="sm" onClick={() => ghTitleRef.current?.focus()}>
                  <Plus className="size-4" /> 添加第一条记录
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {github.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-3 backdrop-blur-md"
                >
                  <FolderGit2 className="size-5 shrink-0 text-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{g.title}</p>
                    {g.content ? (
                      <p className="truncate text-xs text-muted-foreground">{g.content}</p>
                    ) : null}
                  </div>
                  {g.url ? (
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
                      aria-label="打开链接"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                  <button
                    onClick={() => deleteGithub(g.id)}
                    aria-label="删除"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}







