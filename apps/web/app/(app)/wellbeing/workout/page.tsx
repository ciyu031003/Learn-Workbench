"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Workout, WorkoutItem } from "@learn-workbench/shared/schemas";
import { workoutVolume } from "@learn-workbench/shared/pure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { useToastStore } from "@/store/toast-store";
import { NumberStepper } from "@/components/workout/number-stepper";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Dumbbell, Loader2, Timer, ChevronLeft, ChevronDown } from "lucide-react";

interface DraftItem {
  /** 动作库 key（自定义动作为 null） */
  exerciseKey: string | null;
  exerciseLabel: string;
  sets: string;
  reps: string;
  weightKg: string;
}

const EMPTY_ITEM: DraftItem = { exerciseKey: null, exerciseLabel: "", sets: "4", reps: "8", weightKg: "" };

/** 顶部指标块：窄屏 2 列 / 大屏 4 列，只读汇总，不参与写入。 */
function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border-button-default bg-background-secondary-default px-4 py-3">
      <span className="flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
        <Icon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-title-3-semibold tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

export default function WorkoutPage() {
  const pushToast = useToastStore((s) => s.push);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("训练");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [durationMin, setDurationMin] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);
  /** 正在用动作库挑选的行（null = 未打开） */
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/workouts?days=60");
      if (!r.ok) throw new Error("加载失败");
      const d = await r.json();
      setWorkouts(Array.isArray(d.workouts) ? d.workouts : []);
    } catch {
      pushToast("训练记录加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  const totals = useMemo(() => workoutVolume(workouts.flatMap((w) => w.items)), [workouts]);
  const totalMinutes = useMemo(
    () => workouts.reduce((sum, w) => sum + Math.round((w.durationSeconds ?? 0) / 60), 0),
    [workouts]
  );

  const resetForm = () => {
    setName("训练");
    setDurationMin("");
    setNote("");
    setItems([{ ...EMPTY_ITEM }]);
  };

  const save = async () => {
    const cleaned = items
      .map((it) => ({
        exerciseKey: it.exerciseKey,
        exerciseLabel: it.exerciseLabel.trim(),
        sets: Number(it.sets) || 0,
        reps: Number(it.reps) || 0,
        weightKg: it.weightKg.trim() === "" ? null : Number(it.weightKg),
      }))
      .filter((it) => it.exerciseLabel);
    if (cleaned.length === 0) {
      pushToast("至少填写一个动作", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          exercisedOn: date,
          durationSeconds: Math.max(0, Math.round((Number(durationMin) || 0) * 60)),
          note,
          items: cleaned,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "保存失败");
      }
      pushToast("已记录训练");
      setOpen(false);
      resetForm();
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (w: Workout) => {
    if (!window.confirm(`删除「${w.name}」这次训练？`)) return;
    try {
      const r = await fetch(`/api/workouts/${w.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      pushToast("已删除");
      await load();
    } catch {
      pushToast("删除失败", "error");
    }
  };

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="训练记录"
        description="轻量记录动作 / 组数 / 次数 / 重量 · 近 60 天"
        icon={<Dumbbell className="size-5" />}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/wellbeing">
                <ChevronLeft className="size-4" /> 健康
              </Link>
            </Button>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="size-4" /> 记录训练
            </Button>
          </>
        }
      />

      {/* 指标条：2 列（窄屏）/ 4 列（大屏），避免一排超宽数字条贯穿整页 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Dumbbell} label="近 60 天训练" value={`${workouts.length} 次`} />
        <StatTile icon={Timer} label="累计时长" value={`${totalMinutes} 分钟`} />
        <StatTile icon={Dumbbell} label="总组数 / 总次数" value={`${totals.sets} / ${totals.reps}`} />
        <StatTile icon={Dumbbell} label="总容量" value={`${totals.volumeKg.toLocaleString("zh-CN")} kg`} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border-button-default bg-background-secondary-default p-8 text-body-medium text-text-secondary">
          <Loader2 className="size-4 animate-spin" /> 加载中…
        </div>
      ) : workouts.length === 0 ? (
        <EmptyState icon={Dumbbell} title="还没有训练记录" hint="记录一次训练，动作与容量会自动汇总" pattern="bauhaus" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {workouts.map((w, wi) => {
            const v = workoutVolume(w.items);
            return (
              <article
                key={w.id}
                style={{ animationDelay: `${Math.min(wi, 10) * 45}ms` }}
                className="rise-in flex h-[340px] min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default"
              >
                <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-headline-medium text-text-primary">{w.name}</h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-caption-1-medium text-text-secondary">
                      <span>{w.exercisedOn}</span>
                      {w.durationSeconds > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="size-3" />
                          {Math.round(w.durationSeconds / 60)} 分钟
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    onClick={() => void remove(w)}
                    className="press shrink-0 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-danger/12 hover:text-danger"
                    aria-label="删除"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </header>

                {/* 动作明细：卡内滚动，顶部柔和渐隐（长训练不再把卡片拉长） */}
                <div className="min-h-0 flex-1 px-5 pb-1">
                  <ScrollFade className="h-full">
                    {w.items.length === 0 ? (
                      <p className="text-body-2-medium text-text-tertiary">无动作明细</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-separator-border">
                        {w.items.map((it: WorkoutItem, i) => (
                          <div
                            key={it.id ?? i}
                            className="press-soft flex items-center justify-between gap-3 rounded-md py-1.5 text-body-2-medium transition-colors hover:bg-background-tertiary-default/60"
                          >
                            <span className="min-w-0 truncate font-medium text-text-primary">{it.exerciseLabel}</span>
                            <span className="shrink-0 tabular-nums text-text-secondary">
                              {it.sets} × {it.reps}
                              {it.weightKg !== null ? ` · ${it.weightKg}kg` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {w.note ? <p className="mt-2 text-caption-1-medium text-text-tertiary">{w.note}</p> : null}
                  </ScrollFade>
                </div>

                <footer className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-separator-border px-5 py-3">
                  <Badge variant="muted">{v.sets} 组</Badge>
                  <Badge variant="muted">{v.reps} 次</Badge>
                  {v.volumeKg > 0 ? <Badge variant="accent">{v.volumeKg.toLocaleString("zh-CN")} kg</Badge> : null}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <GlassModal open={open} onClose={() => setOpen(false)} title="记录训练" className="max-w-lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">训练名称</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="胸 + 三头" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">日期</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">时长（分钟，可留空）</label>
            <Input type="number" min={0} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="45" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium">动作明细</label>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setItems((s) => [...s, { ...EMPTY_ITEM }])}>
                <Plus className="size-3.5" /> 添加动作
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((it, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPickingIndex(i)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className={cn("min-w-0 flex-1 truncate text-sm", it.exerciseLabel ? "font-semibold" : "text-muted-foreground")}>
                        {it.exerciseLabel || "选择动作"}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setItems((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s))}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                      aria-label="移除动作"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {/* 三个字段各自一行（sm 以上三列）＋ ± 按钮：不再把「组/次/kg」挤成一行 */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <NumberStepper
                      label="组数"
                      value={it.sets}
                      onChange={(v) => setItems((s) => s.map((x, j) => (j === i ? { ...x, sets: v } : x)))}
                      placeholder="4"
                      suffix="组"
                      min={1}
                      max={30}
                    />
                    <NumberStepper
                      label="次数"
                      value={it.reps}
                      onChange={(v) => setItems((s) => s.map((x, j) => (j === i ? { ...x, reps: v } : x)))}
                      placeholder="8"
                      suffix="次"
                      min={1}
                      max={100}
                    />
                    <NumberStepper
                      label="重量"
                      value={it.weightKg}
                      onChange={(v) => setItems((s) => s.map((x, j) => (j === i ? { ...x, weightKg: v } : x)))}
                      placeholder="自重"
                      suffix="kg"
                      step={2.5}
                      min={0}
                      max={500}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">备注</label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="状态、感受等" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving}>{saving ? "保存中…" : "保存训练"}</Button>
          </div>
        </div>
      </GlassModal>

      {/* v8 P4-a：动作库选择器（分类大卡 + 搜索 + 内置目录回退） */}
      <ExercisePicker
        open={pickingIndex !== null}
        onClose={() => setPickingIndex(null)}
        onPick={(item) => {
          if (pickingIndex === null) return;
          setItems((s) =>
            s.map((x, j) => (j === pickingIndex ? { ...x, exerciseKey: item.key, exerciseLabel: item.name } : x))
          );
        }}
      />
    </div>
  );
}
