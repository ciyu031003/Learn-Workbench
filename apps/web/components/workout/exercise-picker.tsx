"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EXERCISE_CATALOG,
  exerciseTypeOptions,
  filterExercises,
  type ExerciseFilterable,
} from "@learn-workbench/shared";
import { GlassModal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Activity, BicepsFlexed, Bike, Dumbbell, Footprints, Loader2, Search, Volleyball } from "lucide-react";

/** `/api/exercises` 返回项（内置目录回退时无 id） */
interface PickerItem extends ExerciseFilterable {
  id?: number | null;
}

const CATEGORY_ICONS: Record<string, typeof Dumbbell> = {
  ALL: Search,
  STRENGTH: Dumbbell,
  AEROBIC: Bike,
  STRETCH: BicepsFlexed,
  BALL: Volleyball,
  MOVE: Footprints,
  OTHER: Activity,
};

function fallbackCatalog(): PickerItem[] {
  return EXERCISE_CATALOG.map((e) => ({
    key: e.key,
    name: e.name,
    muscleGroup: e.muscleGroup,
    category: e.category,
    equipment: e.equipment,
  }));
}

/**
 * 动作库选择器（v8 P4-a，与 APP v6 对齐）：分类大卡片 + 搜索 + 列表 + 自定义输入。
 * 数据源 `/api/exercises?limit=200`（v6 迁移 046 的 71 条种子），失败回退内置 EXERCISE_CATALOG。
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: { key: string | null; name: string }) => void;
}) {
  const [catalog, setCatalog] = useState<PickerItem[]>(fallbackCatalog);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("ALL");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/exercises?limit=200");
        const d = await r.json();
        if (alive && r.ok && Array.isArray(d.exercises) && d.exercises.length > 0) {
          setCatalog(d.exercises as PickerItem[]);
        }
      } catch {
        // 离线：继续用内置目录
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: catalog.length };
    for (const t of exerciseTypeOptions) {
      map[t.type] = filterExercises(catalog, { q: "", category: t.type }).length;
    }
    return map;
  }, [catalog]);

  const tabs = useMemo(
    () => [{ type: "ALL" as const, label: "全部" }, ...exerciseTypeOptions].filter((t) => t.type === "ALL" || (counts[t.type] ?? 0) > 0),
    [counts]
  );

  const list = useMemo(
    () => filterExercises(catalog, { q, category: category === "ALL" ? "" : category }),
    [catalog, q, category]
  );

  const pick = useCallback(
    (item: { key: string | null; name: string }) => {
      onPick(item);
      setQ("");
      onClose();
    },
    [onClose, onPick]
  );

  return (
    <GlassModal open={open} onClose={onClose} title="选择动作" className="max-w-xl">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索动作 / 部位 / 器械（如 卧推、胸、哑铃）"
            className="h-10 pl-9"
          />
          {loading ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
        </div>

        {/* 分类大卡片（2×2/3 列）：与 APP v6 的分类卡一致 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabs.map((t, ti) => {
            const Icon = CATEGORY_ICONS[t.type] ?? Activity;
            const active = category === t.type;
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => setCategory(t.type)}
                style={{ animationDelay: `${ti * 40}ms` }}
                className={cn(
                  "press rise-in flex flex-col items-start gap-1 rounded-2xl border px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                  active
                    ? "border-primary/60 bg-primary/12 text-primary shadow-[0_10px_30px_-18px_rgba(47,116,192,0.9)]"
                    : "border-border/60 bg-card/60 text-muted-foreground hover:border-primary/30"
                )}
              >
                <Icon className="size-4" />
                <span className="text-xs font-semibold">{t.label}</span>
                <span className="text-[10px] opacity-70">{counts[t.type] ?? 0} 个</span>
              </button>
            );
          })}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-2xl border border-border/60">
          {list.length === 0 ? (
            <div className="relative overflow-hidden px-4 py-8 text-center">
              <span
                aria-hidden
                className="pattern-chevron pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
              />
              <p className="relative text-xs font-medium text-foreground">没有匹配的动作</p>
              <p className="relative mt-1 text-[11px] text-muted-foreground">换个词，或用下面的「手动输入动作名」</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/40">
              {list.map((e, i) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => pick({ key: e.key, name: e.name })}
                  style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
                  className="rise-in press-soft group flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/8"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{e.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {e.muscleGroup}
                      {e.equipment ? ` · ${e.equipment}` : ""}
                    </span>
                  </span>
                  <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => pick({ key: null, name: q.trim() || "自定义动作" })}
          className="press-scale rounded-xl border border-border/60 bg-muted/40 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          没有？手动输入动作名
        </button>
      </div>
    </GlassModal>
  );
}
