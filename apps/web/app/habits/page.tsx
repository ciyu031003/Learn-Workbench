"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HABIT_TEMPLATES,
  HABIT_WEEKDAY_LABELS,
  computeHabitStats,
  isHabitDone,
  isScheduled,
  toDateKey,
  type Habit,
  type HabitLog,
} from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Flame, Check, Loader2, Repeat, Pencil } from "lucide-react";

type HabitRow = Habit & { archivedAt?: string | null };

interface FormState {
  id: number | null;
  name: string;
  icon: string;
  isBoolean: boolean;
  targetValue: string;
  unit: string;
  schedule: number[];
  color: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  icon: "✅",
  isBoolean: true,
  targetValue: "",
  unit: "",
  schedule: [0, 1, 2, 3, 4, 5, 6],
  color: "#6366f1",
};

const COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

export default function HabitsPage() {
  const pushToast = useToastStore((s) => s.push);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/habits");
      if (!r.ok) throw new Error("习惯加载失败");
      const d = await r.json();
      setHabits(Array.isArray(d.habits) ? d.habits : []);
      setLogs(Array.isArray(d.logs) ? d.logs : []);
    } catch {
      pushToast("习惯加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  const logKey = (habitId: number, date: string) => `${habitId}|${date}`;
  const logMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) m.set(logKey(l.habitId, l.logDate.slice(0, 10)), Number(l.value));
    return m;
  }, [logs]);

  const statsByHabit = useMemo(() => {
    const m = new Map<number, ReturnType<typeof computeHabitStats>>();
    for (const h of habits) m.set(h.id, computeHabitStats(h, logs, today));
    return m;
  }, [habits, logs, today]);

  /** One-Tap 打卡 / 取消（乐观更新） */
  const toggle = async (h: HabitRow, date = todayKey) => {
    const done = logMap.get(logKey(h.id, date)) !== undefined;
    setBusy(h.id);
    try {
      const r = done
        ? await fetch(`/api/habits/logs?habitId=${h.id}&date=${date}`, { method: "DELETE" })
        : await fetch("/api/habits/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ habitId: h.id, date, value: 1 }),
          });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "操作失败");
      }
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "操作失败", "error");
    } finally {
      setBusy(null);
    }
  };

  const setValue = async (h: HabitRow, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return;
    try {
      const r = await fetch("/api/habits/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId: h.id, date: todayKey, value }),
      });
      if (!r.ok) throw new Error("记录失败");
      await load();
    } catch {
      pushToast("记录失败", "error");
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      pushToast("请填写习惯名称", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        icon: form.icon,
        isBoolean: form.isBoolean,
        targetValue: form.isBoolean ? null : Number(form.targetValue) || null,
        unit: form.isBoolean ? null : form.unit || null,
        schedule: form.schedule,
        color: form.color,
      };
      const r = form.id
        ? await fetch(`/api/habits/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/habits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "保存失败");
      }
      pushToast(form.id ? "已更新" : "已添加");
      setOpen(false);
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h: HabitRow) => {
    if (!window.confirm(`删除习惯「${h.name}」？历史打卡将不再展示。`)) return;
    try {
      const r = await fetch(`/api/habits/${h.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      pushToast("已删除");
      await load();
    } catch {
      pushToast("删除失败", "error");
    }
  };

  const openCreate = (tpl?: (typeof HABIT_TEMPLATES)[number]) => {
    setForm(
      tpl
        ? {
            id: null,
            name: tpl.name,
            icon: tpl.icon,
            isBoolean: tpl.isBoolean,
            targetValue: tpl.targetValue === null ? "" : String(tpl.targetValue),
            unit: tpl.unit ?? "",
            schedule: [0, 1, 2, 3, 4, 5, 6],
            color: tpl.color,
          }
        : EMPTY_FORM
    );
    setOpen(true);
  };

  const openEdit = (h: HabitRow) => {
    setForm({
      id: h.id,
      name: h.name,
      icon: h.icon ?? "✅",
      isBoolean: h.isBoolean,
      targetValue: h.targetValue === null ? "" : String(h.targetValue),
      unit: h.unit ?? "",
      schedule: Array.isArray(h.schedule) && h.schedule.length > 0 ? h.schedule : [0, 1, 2, 3, 4, 5, 6],
      color: h.color,
    });
    setOpen(true);
  };

  /** 近 7 天（旧→新） */
  const last7 = useMemo(() => {
    const out: { key: string; date: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      d.setDate(d.getDate() - i);
      out.push({ key: toDateKey(d), date: d });
    }
    return out;
  }, [today]);

  /** 近 91 天热力图（13 周 × 7 天，列=周，行=星期） */
  const heatmapDays = useMemo(() => {
    const days: { key: string; date: Date }[] = [];
    for (let i = 90; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      d.setDate(d.getDate() - i);
      days.push({ key: toDateKey(d), date: d });
    }
    return days;
  }, [today]);

  const scheduledToday = habits.filter((h) => isScheduled(h.schedule, today)).length;
  const doneToday = habits.filter((h) => {
    const v = logMap.get(logKey(h.id, todayKey));
    return v !== undefined && isHabitDone(h, v);
  }).length;

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">习惯</h1>
          <p className="page-subtitle mt-1 text-sm">
            今日 {doneToday}/{scheduledToday} 已完成 · 连续打卡与热力图
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => openCreate()} className="gap-1.5">
            <Plus className="size-4" /> 自定义习惯
          </Button>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 加载中…
        </CardContent></Card>
      ) : habits.length === 0 ? (
        <div className="flex flex-col gap-4">
          <EmptyState icon={Repeat} title="还没有习惯" hint="从下面的模板快速开始，或自定义一个" />
          <div className="flex flex-wrap justify-center gap-2">
            {HABIT_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => openCreate(t)}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3.5 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <span>{t.icon}</span>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 今日打卡 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">今日打卡</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {habits.map((h) => {
                const v = logMap.get(logKey(h.id, todayKey));
                const done = v !== undefined && isHabitDone(h, v);
                const st = statsByHabit.get(h.id);
                const scheduled = isScheduled(h.schedule, today);
                return (
                  <Card key={h.id} className={cn(!scheduled && "opacity-60")}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <button
                        onClick={() => void toggle(h)}
                        disabled={busy === h.id}
                        aria-label={done ? "取消打卡" : "打卡"}
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-2xl border transition-all",
                          done ? "border-transparent text-white" : "border-border/70 text-muted-foreground hover:bg-muted/50"
                        )}
                        style={done ? { background: h.color } : undefined}
                      >
                        {busy === h.id ? <Loader2 className="size-4 animate-spin" /> : done ? <Check className="size-5" /> : <span className="text-lg">{h.icon ?? "○"}</span>}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{h.icon} {h.name}</span>
                          {st && st.currentStreak > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-warning">
                              <Flame className="size-3" />{st.currentStreak}
                            </span>
                          ) : null}
                          {!scheduled ? <Badge variant="muted">今日不排期</Badge> : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span>近 7 天 {st?.weekRate ?? 0}%</span>
                          <span>近 30 天 {st?.monthRate ?? 0}%</span>
                          <span>最长 {st?.longestStreak ?? 0} 天</span>
                        </div>

                        {/* 近 7 天小条 */}
                        <div className="mt-1.5 flex items-center gap-1">
                          {last7.map((d) => {
                            const dv = logMap.get(logKey(h.id, d.key));
                            const dDone = dv !== undefined && isHabitDone(h, dv);
                            const dSched = isScheduled(h.schedule, d.date);
                            return (
                              <span
                                key={d.key}
                                title={d.key}
                                className={cn(
                                  "h-1.5 w-5 rounded-full",
                                  dDone ? "" : dSched ? "bg-muted" : "bg-muted/30"
                                )}
                                style={dDone ? { background: h.color } : undefined}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {!h.isBoolean ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            defaultValue={v ?? ""}
                            onBlur={(e) => void setValue(h, e.target.value)}
                            className="h-8 w-16 text-center text-xs"
                            aria-label={`${h.name} 数值`}
                          />
                          <span className="text-[11px] text-muted-foreground">{h.unit ?? ""}</span>
                        </div>
                      ) : null}

                      <div className="flex shrink-0 flex-col gap-1">
                        <button onClick={() => openEdit(h)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="编辑">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => void remove(h)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-danger" aria-label="删除">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* 完整热力图 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">近 13 周热力图</h2>
            <div className="flex flex-col gap-4">
              {habits.map((h) => (
                <Card key={h.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span>{h.icon}</span>{h.name}
                      <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                        近 90 天 {statsByHabit.get(h.id)?.monthRate ?? 0}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-[3px] pt-[13px]">
                        {HABIT_WEEKDAY_LABELS.map((w, i) => (
                          <span key={w} className="h-3 text-[9px] leading-3 text-muted-foreground">
                            {i % 2 === 1 ? w : ""}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-[3px]" style={{ maxWidth: 13 * 15 }}>
                        {heatmapDays.map((d) => {
                          const dv = logMap.get(logKey(h.id, d.key));
                          const dDone = dv !== undefined && isHabitDone(h, dv);
                          const dSched = isScheduled(h.schedule, d.date);
                          return (
                            <span
                              key={d.key}
                              title={`${d.key}${dDone ? " 已完成" : dSched ? " 未完成" : " 不排期"}`}
                              className={cn("size-3 rounded-[3px]", dDone ? "" : dSched ? "bg-muted" : "bg-muted/25")}
                              style={dDone ? { background: h.color } : undefined}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      {/* 新建 / 编辑 */}
      <GlassModal open={open} onClose={() => setOpen(false)} title={form.id ? "编辑习惯" : "新建习惯"}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="w-20">
              <label className="mb-1 block text-xs font-medium">图标</label>
              <Input value={form.icon} onChange={(e) => setForm((s) => ({ ...s, icon: e.target.value.slice(0, 2) }))} className="text-center text-lg" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium">名称 *</label>
              <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="如：饮水 / 早睡" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, isBoolean: true }))}
                className={cn("flex-1 rounded-xl border px-3 py-2 text-sm", form.isBoolean ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-muted/50")}
              >
                打卡型（完成 / 未完成）
              </button>
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, isBoolean: false }))}
                className={cn("flex-1 rounded-xl border px-3 py-2 text-sm", !form.isBoolean ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-muted/50")}
              >
                量化型（记录数值）
              </button>
            </div>
          </div>

          {!form.isBoolean ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">目标值</label>
                <Input type="number" value={form.targetValue} onChange={(e) => setForm((s) => ({ ...s, targetValue: e.target.value }))} placeholder="8" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">单位</label>
                <Input value={form.unit} onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))} placeholder="杯 / 分钟 / 页" />
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium">排期（默认每天）</label>
            <div className="flex gap-1.5">
              {HABIT_WEEKDAY_LABELS.map((label, idx) => {
                const on = form.schedule.includes(idx);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setForm((s) => {
                        const next = on ? s.schedule.filter((x) => x !== idx) : [...s.schedule, idx].sort((a, b) => a - b);
                        return { ...s, schedule: next.length > 0 ? next : [0, 1, 2, 3, 4, 5, 6] };
                      })
                    }
                    className={cn(
                      "size-8 rounded-full text-xs transition-colors",
                      on ? "bg-primary/25 text-foreground ring-1 ring-primary/50" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">颜色</label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, color: c }))}
                  className={cn("size-7 rounded-full border-2", form.color === c ? "border-foreground" : "border-transparent")}
                  style={{ background: c }}
                  aria-label={`颜色 ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}