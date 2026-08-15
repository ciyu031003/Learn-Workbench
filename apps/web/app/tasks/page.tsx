"use client";

import { useCallback, useEffect, useState } from "react";
import type { DailyTask } from "@learn-workbench/shared";
import { todayISO, taskTypeLabels, formatDateCN } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Play, Plus, Timer as TimerIcon } from "lucide-react";
import { FocusTimer } from "@/components/focus-timer";
import { FocusStatsCard } from "@/components/focus-stats-card";

const TYPES = ["study", "agent", "output", "review", "exam"] as const;

interface PhaseStat {
  phaseId: number | null;
  phaseTitle: string;
  totalMinutes: number;
  sessionCount: number;
}

export default function TasksPage() {
  const [date, setDate] = useState(todayISO());
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("study");
  const [phaseId, setPhaseId] = useState<string>("");
  const [phases, setPhases] = useState<{ id: number; title: string; track: string }[]>([]);
  const [stats, setStats] = useState<PhaseStat[]>([]);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSession, setTimerSession] = useState(0);
  const [timerTask, setTimerTask] = useState<{ id: number | null; title: string | null } | null>(null);

  const load = useCallback(async (d: string) => {
    const r = await fetch(`/api/tasks?date=${d}`);
    const data = await r.json();
    setTasks(data.tasks ?? []);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/focus/stats");
      const data = await r.json();
      setStats(data.stats ?? []);
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    // 数据加载属于外部系统同步，异步 setState 不受影响
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date);
  }, [date, load]);

  useEffect(() => {
    (async () => {
      try {
        const [ph, st] = await Promise.all([
          fetch("/api/phases").then((r) => r.json()),
          fetch("/api/focus/stats").then((r) => r.json()),
        ]);
        setPhases(ph.phases ?? []);
        setStats(st.stats ?? []);
      } catch {
        // 忽略
      }
    })();
  }, []);

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const addTask = async () => {
    if (!title.trim()) return;
    const r = await fetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        taskDate: date,
        title: title.trim(),
        taskType: type,
        phaseId: phaseId ? Number(phaseId) : null,
      }),
    });
    if (r.ok) {
      setTitle("");
      load(date);
    }
  };

  const toggleDone = async (id: number, done: boolean) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id, done }),
    });
    load(date);
  };

  const openTimer = (taskId: number | null, taskTitle: string | null) => {
    setTimerTask({ id: taskId, title: taskTitle });
    setTimerSession((s) => s + 1);
    setTimerOpen(true);
  };

  const totalFocus = tasks.reduce((a, t) => a + t.focusMinutes, 0);

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">每日任务</h1>
          <p className="page-subtitle mt-1 text-sm">计划 → 专注 → 复盘，形成学习闭环</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} aria-label="前一天">
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            aria-label="选择日期"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)} aria-label="后一天">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 专注计时：点击进入横屏倒计时 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>专注计时</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <div className="flex items-center gap-2 font-mono text-4xl font-semibold tracking-tight tabular-nums">
              <TimerIcon className="size-6 text-primary" />
              25:00
            </div>
            <Button onClick={() => openTimer(null, null)} className="w-full">
              <Play className="size-4" /> 开始倒计时
            </Button>
            <p className="text-xs text-muted-foreground">
              进入全屏横屏倒计时，可切换时钟样式；当日累计专注 {totalFocus} 分钟
            </p>
          </CardContent>
        </Card>

        {/* 新建任务 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>新建任务</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              placeholder="今天要学什么？（如：HCIP 路由交换第 3 章）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                className="glass-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md"
                aria-label="选择路线图大类"
              >
                <option value="">路线图大类（不限）</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={type} onValueChange={(v) => setType(v as (typeof TYPES)[number])}>
                  <TabsList>
                    {TYPES.map((t) => (
                      <TabsTrigger key={t} value={t}>
                        {taskTypeLabels[t]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button onClick={addTask} className="ml-auto">
                  <Plus className="size-4" /> 添加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{formatDateCN(date)} 的任务</CardTitle>
          <Badge variant="muted">
            {tasks.filter((t) => t.done).length}/{tasks.length} 已完成
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">这一天还没有任务，添加一个开始吧</p>
          ) : (
            tasks.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${t.done ? "border-success/20 bg-success/5" : "border-border/60 bg-muted/30"}`}
              >
                <button onClick={() => toggleDone(t.id, !t.done)} aria-label={t.done ? "标记为未完成" : "标记为完成"} className="shrink-0 rounded-lg p-2 -m-2">
                  {t.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground/50 hover:text-primary" />}
                </button>
                <span className={`min-w-0 flex-1 text-sm font-medium ${t.done ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                </span>
                <Badge variant="muted">{taskTypeLabels[t.taskType] ?? t.taskType}</Badge>
                {t.focusMinutes > 0 ? (
                  <Badge variant="accent">{t.focusMinutes} 分钟</Badge>
                ) : null}
                <Button variant="ghost" size="icon" onClick={() => openTimer(t.id, t.title)} aria-label="开始专注">
                  <Play className="size-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 分类专注统计：每一章大类的学习总时间 */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <TimerIcon className="size-5 text-primary" />
          <CardTitle>分类专注统计</CardTitle>
          <Badge variant="muted">按路线图大类汇总</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stats.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">还没有专注记录，开始一次倒计时吧</p>
          ) : (
            stats.map((s) => (
              <div
                key={s.phaseId ?? 0}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.phaseTitle}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{s.totalMinutes} 分钟</span> · {s.sessionCount} 次
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 专注打卡统计（计时完成 / 完成当日全部任务后可分享） */}
      {tasks.length > 0 && tasks.every((t) => t.done) ? (
        <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
          🎉 今日任务已全部完成！生成你的专注打卡卡片分享一下吧
        </div>
      ) : null}
      <FocusStatsCard />

      <FocusTimer
        key={timerSession}
        open={timerOpen}
        task={timerTask}
        onClose={() => setTimerOpen(false)}
        onRecorded={() => {
          load(date);
          loadStats();
        }}
      />
    </div>
  );
}
