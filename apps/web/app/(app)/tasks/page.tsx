"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { taskTypeLabels } from "@learn-workbench/shared/labels";
import { formatDateCN } from "@learn-workbench/shared/dates";
import { addDaysToDateKey, todayISOInZone } from "@learn-workbench/shared/domains";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, ListTodo, Play, Plus, Timer as TimerIcon, ArrowRight } from "lucide-react";
import { FocusTimer } from "@/components/focus-timer";
import { FocusStatsCard } from "@/components/focus-stats-card";
import { DomainIcon } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import { useToastStore } from "@/store/toast-store";
import { parseAutofocusParams } from "@/lib/autofocus";
import { Celebration } from "@/components/celebration";

const TYPES = ["study", "agent", "output", "review", "exam"] as const;

interface PhaseStat {
  phaseId: number | null;
  phaseTitle: string;
  totalMinutes: number;
  sessionCount: number;
}

export default function TasksPage() {
  const router = useRouter();
  const domain = useDomainStore((s) => s.current);
  const careerKey = domain?.careerKey ?? "ict";
  const [date, setDate] = useState(todayISOInZone());
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [title, setTitle] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<(typeof TYPES)[number]>("study");
  const [phaseId, setPhaseId] = useState<string>("");
  const [phases, setPhases] = useState<{ id: number; title: string; track: string }[]>([]);
  const [stats, setStats] = useState<PhaseStat[]>([]);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSession, setTimerSession] = useState(0);
  const [timerTask, setTimerTask] = useState<{ id: number | null; title: string | null } | null>(null);
  const [timerAuto, setTimerAuto] = useState<{
    autoStart: boolean;
    mode: "focus" | "exercise";
    minutes?: number;
    label?: string;
    stype?: string;
  }>({
    autoStart: false,
    mode: "focus",
  });
  const [celebration, setCelebration] = useState<"sparkle" | "confetti" | null>(null);
  const autofocusHandled = useRef(false);
  const pushToast = useToastStore((s) => s.push);

  const load = useCallback(async (d: string) => {
    const r = await fetch(`/api/tasks?date=${d}&career=${careerKey}`);
    const data = await r.json();
    setTasks(data.tasks ?? []);
  }, [careerKey]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`/api/focus/stats?career=${careerKey}`);
      const data = await r.json();
      setStats(data.stats ?? []);
    } catch {
      // 忽略
    }
  }, [careerKey]);

  useEffect(() => {
    // 数据加载属于外部系统同步，异步 setState 不受影响
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date);
  }, [date, load]);

  useEffect(() => {
    // 领域切换后阶段下拉与专注统计跟随当前领域（任务列表由上方 load 效果联动）
    (async () => {
      try {
        const [ph, st] = await Promise.all([
          fetch(`/api/phases?career=${careerKey}`).then((r) => r.json()),
          fetch(`/api/focus/stats?career=${careerKey}`).then((r) => r.json()),
        ]);
        setPhases(ph.phases ?? []);
        setStats(st.stats ?? []);
      } catch {
        // 忽略
      }
    })();
  }, [careerKey]);

  // S5-1：日期键 ±N 天走 shared 的纯日历运算（旧实现用本地 Date + toISOString，东八区晚 8 点后会少一天）
  const shiftDate = (delta: number) => {
    setDate(addDaysToDateKey(date, delta));
  };

  const addTask = async () => {
    if (!title.trim()) return;
    const taskTitle = title.trim();
    const r = await fetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        taskDate: date,
        title: taskTitle,
        taskType: type,
        phaseId: phaseId ? Number(phaseId) : null,
        career: careerKey,
      }),
    });
    if (r.ok) {
      setTitle("");
      pushToast(`已添加「${taskTitle}」`, "success");
      setCelebration("sparkle");
      load(date);
    }
  };

  const toggleDone = async (id: number, done: boolean) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id, done }),
    });
    const next = tasks.map((t) => (t.id === id ? { ...t, done } : t));
    setTasks(next);
    if (done) {
      const allDone = next.every((t) => t.done);
      pushToast(allDone ? "今日任务全部完成！" : "任务完成，继续保持", "success");
      setCelebration(allDone ? "confetti" : "sparkle");
    } else {
      load(date);
    }
  };

  const openTimer = (taskId: number | null, taskTitle: string | null) => {
    setTimerTask({ id: taskId, title: taskTitle });
    setTimerAuto({ autoStart: false, mode: "focus" });
    setTimerSession((s) => s + 1);
    setTimerOpen(true);
  };

  // 快捷开始：/tasks?autofocus=study|exercise&minutes=N 自动打开并启动倒计时（解析后清除参数）
  useEffect(() => {
    if (autofocusHandled.current || timerOpen) return;
    const parsed = parseAutofocusParams(window.location.search);
    if (!parsed) return;
    autofocusHandled.current = true;
    const { mode, minutes, label, stype } = parsed;
    // 延迟一帧再打开计时器：避免 effect 体内同步 setState 触发级联渲染
    const t = window.setTimeout(() => {
      setTimerTask({ id: null, title: null });
      setTimerAuto({ autoStart: true, mode, minutes, label, stype });
      setTimerSession((s) => s + 1);
      setTimerOpen(true);
      router.replace("/tasks");
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalFocus = tasks.reduce((a, t) => a + t.focusMinutes, 0);
  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="每日任务"
        description="计划 → 专注 → 复盘，形成学习闭环"
        eyebrow={
          domain ? (
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 rounded-xl border border-border-button-default bg-background-secondary-default py-1.5 pe-2.5 ps-2 transition-colors hover:bg-background-secondary-hover"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${domain.color}26`, color: domain.color }}
              >
                <DomainIcon icon={domain.icon} className="size-3.5" />
              </span>
              <span className="max-w-40 truncate text-body-2-medium text-text-secondary">{domain.name}</span>
              <ArrowRight className="size-3.5 shrink-0 text-foreground-icon-tertiary" />
            </Link>
          ) : undefined
        }
        actions={
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
        }
      />

      {/* 专注计时 + 新建任务：3 列网格（1 + 2） */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default">
          <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-primary-default">
              <TimerIcon className="size-4 text-foreground-icon-secondary" />
            </span>
            <h2 className="min-w-0 truncate text-headline-medium text-text-primary">专注计时</h2>
          </div>
          <div className="flex flex-col items-center gap-4 px-5 pb-5 pt-1">
            <div className="flex items-center gap-2 font-mono text-display-3-semibold tabular-nums text-text-primary">
              <TimerIcon className="size-6 text-foreground-icon-secondary" />
              25:00
            </div>
            <Button onClick={() => openTimer(null, null)} className="w-full">
              <Play className="size-4" /> 开始倒计时
            </Button>
            <p className="text-center text-caption-1-regular text-text-tertiary">
              进入全屏横屏倒计时，可切换时钟样式；当日累计专注 {totalFocus} 分钟
            </p>
          </div>
        </section>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default lg:col-span-2">
          <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-secondary-default">
              <Plus className="size-4 text-foreground-icon-secondary" />
            </span>
            <h2 className="min-w-0 truncate text-headline-medium text-text-primary">新建任务</h2>
          </div>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <Input
              ref={titleRef}
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
                className="h-10 rounded-xl border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary"
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
          </div>
        </section>
      </div>

      {/* 任务列表（卡内滚动）+ 分类专注统计：2/3 网格，页面不再被长列表拉长 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default lg:col-span-2 lg:h-[340px]">
          <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-primary-default">
              <ListTodo className="size-4 text-foreground-icon-secondary" />
            </span>
            <h2 className="min-w-0 truncate text-headline-medium text-text-primary">{formatDateCN(date)} 的任务</h2>
            <Badge variant="muted" className="ms-auto shrink-0">
              {doneCount}/{tasks.length} 已完成
            </Badge>
          </div>
          <div className="min-h-0 flex-1 px-5 pb-4">
            {tasks.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                title="这一天还没有任务"
                hint="添加一个学习任务，开始「计划 → 专注 → 复盘」闭环"
                pattern="bauhaus"
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      titleRef.current?.focus();
                      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    <Plus className="size-4" /> 添加任务
                  </Button>
                }
              />
            ) : (
              <ScrollFade className="h-full">
                <div className="flex flex-col gap-2 pe-1">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                        t.done
                          ? "border-border-button-default bg-background-primary-default"
                          : "border-border-button-default bg-background-primary-default hover:bg-background-secondary-hover"
                      }`}
                    >
                      <button
                        onClick={() => toggleDone(t.id, !t.done)}
                        aria-label={t.done ? "标记为未完成" : "标记为完成"}
                        className="-m-2 shrink-0 rounded-lg p-2"
                      >
                        {t.done ? (
                          <CheckCircle2 className="check-draw size-5 text-success-strong" />
                        ) : (
                          <Circle className="size-5 text-foreground-icon-tertiary transition-colors hover:text-foreground-icon-primary" />
                        )}
                      </button>
                      <span
                        className={`min-w-0 flex-1 truncate text-body-medium ${
                          t.done ? "text-text-tertiary line-through" : "text-text-primary"
                        }`}
                      >
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
                  ))}
                </div>
              </ScrollFade>
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default lg:h-[340px]">
          <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-primary-default">
              <TimerIcon className="size-4 text-foreground-icon-secondary" />
            </span>
            <h2 className="min-w-0 truncate text-headline-medium text-text-primary">分类专注统计</h2>
            <span className="ms-auto shrink-0 rounded-full bg-background-primary-default px-2 py-0.5 text-caption-1-medium text-text-secondary">
              按路线图大类汇总
            </span>
          </div>
          <div className="min-h-0 flex-1 px-5 pb-4">
            {stats.length === 0 ? (
              <p className="py-6 text-center text-body-medium text-text-secondary">还没有专注记录，开始一次倒计时吧</p>
            ) : (
              <ScrollFade className="h-full">
                <div className="flex flex-col gap-2 pe-1">
                  {stats.map((s) => (
                    <div
                      key={s.phaseId ?? 0}
                      className="flex flex-col gap-1.5 rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{s.phaseTitle}</span>
                        <span className="shrink-0 text-caption-1-regular text-text-secondary">
                          <span className="font-semibold tabular-nums text-text-primary">{s.totalMinutes} 分钟</span> · {s.sessionCount} 次
                        </span>
                      </div>
                      <span className="h-1.5 w-full overflow-hidden rounded-full bg-background-tertiary-default">
                        <span
                          className="block h-full rounded-full bg-chart-1"
                          style={{
                            width: `${Math.max(
                              4,
                              Math.round((s.totalMinutes / Math.max(1, ...stats.map((x) => x.totalMinutes))) * 100)
                            )}%`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollFade>
            )}
          </div>
        </section>
      </div>

      {/* 专注打卡统计 + 完成提示：2/3 网格，避免单卡跨全宽 */}
      <div id="focus" className="grid scroll-mt-24 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 xl:col-span-2">
          <FocusStatsCard />
        </div>
        {allDone ? (
          <section className="flex min-w-0 flex-col justify-center gap-2 rounded-3xl border border-border-button-default bg-background-secondary-default p-5">
            <p className="text-headline-medium text-text-primary">今日任务已全部完成！</p>
            <p className="text-body-medium text-text-secondary">生成你的专注打卡卡片分享一下吧</p>
          </section>
        ) : null}
      </div>

      {celebration ? (
        <Celebration
          kind={celebration}
          message={celebration === "confetti" ? "今日任务全部完成！" : "任务已记录"}
          onDone={() => setCelebration(null)}
        />
      ) : null}

      <FocusTimer
        key={timerSession}
        open={timerOpen}
        task={timerTask}
        autoStart={timerAuto.autoStart}
        mode={timerAuto.mode}
        initialMinutes={timerAuto.minutes}
        exerciseLabel={timerAuto.label}
        exerciseType={timerAuto.stype}
        onClose={() => setTimerOpen(false)}
        onRecorded={() => {
          load(date);
          loadStats();
        }}
      />
    </div>
  );
}
