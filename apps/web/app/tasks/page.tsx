"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyTask } from "@learn-workbench/shared";
import { todayISO, taskTypeLabels, formatDateCN } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Play, Square, Plus } from "lucide-react";

const TYPES = ["study", "agent", "output", "review", "exam"] as const;

function fmtClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function TasksPage() {
  const [date, setDate] = useState(todayISO());
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("study");
  const [running, setRunning] = useState<{ taskId: number | null; start: number; elapsed: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (d: string) => {
    const r = await fetch(`/api/tasks?date=${d}`);
    const data = await r.json();
    setTasks(data.tasks ?? []);
  }, []);

  useEffect(() => {
    // 数据加载属于外部系统同步，异步 setState 不受影响
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date);
  }, [date, load]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
      body: JSON.stringify({ taskDate: date, title: title.trim(), taskType: type }),
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

  const startTimer = (taskId: number | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const start = Date.now();
    setRunning({ taskId, start, elapsed: 0 });
    timerRef.current = setInterval(() => {
      setRunning((r) => (r ? { ...r, elapsed: Math.floor((Date.now() - r.start) / 1000) } : r));
    }, 1000);
  };

  const stopTimer = async () => {
    if (!running) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const endedAt = new Date().toISOString();
    await fetch("/api/focus", {
      method: "POST",
      body: JSON.stringify({
        startedAt: new Date(running.start).toISOString(),
        endedAt,
        taskId: running.taskId,
      }),
    });
    setRunning(null);
    load(date);
  };

  const totalFocus = tasks.reduce((a, t) => a + t.focusMinutes, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">每日任务</h1>
          <p className="mt-1 text-sm text-muted-foreground">计划 → 专注 → 复盘，形成学习闭环</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} aria-label="前一天">
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
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
        {/* 专注计时 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>专注计时</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <div className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
              {running ? fmtClock(running.elapsed) : "00:00:00"}
            </div>
            {running ? (
              <Button onClick={stopTimer} variant="danger" className="w-full">
                <Square className="size-4" /> 结束并记录
              </Button>
            ) : (
              <Button onClick={() => startTimer(null)} className="w-full">
                <Play className="size-4" /> 开始专注
              </Button>
            )}
            <p className="text-xs text-muted-foreground">当日累计专注 {totalFocus} 分钟</p>
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
                <button onClick={() => toggleDone(t.id, !t.done)} aria-label="切换完成" className="shrink-0">
                  {t.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground/50 hover:text-primary" />}
                </button>
                <span className={`flex-1 text-sm font-medium ${t.done ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                </span>
                <Badge variant="muted">{taskTypeLabels[t.taskType] ?? t.taskType}</Badge>
                {t.focusMinutes > 0 ? (
                  <Badge variant="accent">{t.focusMinutes} 分钟</Badge>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => (running?.taskId === t.id ? stopTimer() : startTimer(t.id))}
                  aria-label={running?.taskId === t.id ? "结束专注" : "为此任务开始专注"}
                >
                  {running?.taskId === t.id ? <Square className="size-4 text-danger" /> : <Play className="size-4" />}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

