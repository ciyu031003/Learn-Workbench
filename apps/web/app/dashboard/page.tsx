"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardSummary } from "@learn-workbench/shared";
import { formatDuration, taskTypeLabels, formatDateCN } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const checkin = async () => {
    await fetch("/api/checkin", { method: "POST", body: JSON.stringify({}) });
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  const stats = [
    {
      label: "整体进度",
      value: data ? `${data.overallPercent}%` : "—",
      sub: data ? `${data.phases.reduce((a, p) => a + p.done, 0)}/${data.phases.reduce((a, p) => a + p.total, 0)} 主题` : "加载中",
      icon: CheckCircle2,
      accent: "text-primary",
      href: "/roadmap",
    },
    {
      label: "连续打卡",
      value: data ? `${data.streak} 天` : "—",
      sub: "每天学一点",
      icon: Flame,
      accent: "text-orange-500",
      href: "/dashboard",
    },
    {
      label: "本周专注",
      value: data ? formatDuration(data.totalFocusMinutes) : "—",
      sub: "专注会话统计",
      icon: Clock3,
      accent: "text-accent",
      href: "/tasks",
    },
    {
      label: "本周任务",
      value: data ? `${data.weekTaskDone}/${data.weekTaskCount}` : "—",
      sub: "已完成 / 全部",
      icon: ListTodo,
      accent: "text-success",
      href: "/tasks",
    },
  ];

  const mainPhases = data?.phases.filter((p) => p.track === "main") ?? [];
  const agentPhases = data?.phases.filter((p) => p.track === "agent") ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* 问候 */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          {greeting()}，继续今天的 ICT 学习
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatDateCN(today)} · 通信 · 数据 · 云运维 · Agent</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-transform hover:-translate-y-0.5">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <s.icon className={`size-5 ${s.accent}`} />
                </div>
                <span className="text-2xl font-semibold tracking-tight">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.sub}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 整体进度 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>整体学习进度</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/roadmap">
                路线图 <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted">
                <div className="absolute inset-2 rounded-full bg-card" />
                <span className="relative text-xl font-semibold">{data?.overallPercent ?? 0}%</span>
              </div>
              <div className="flex-1 space-y-3">
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
                <Progress value={p.percent} indicatorClassName="bg-accent" />
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
    </div>
  );
}


