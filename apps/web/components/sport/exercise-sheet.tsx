"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Check, Clock3 } from "lucide-react";
import { GlassModal } from "@/components/ui/modal";
import { SportAnimatedIcon } from "@/components/sport/sport-animated-icon";
import { useToastStore } from "@/store/toast-store";
import {
  SPORT_CATALOG,
  exerciseTypeLabels,
  exerciseTypeOptions,
  type ExerciseType,
  type SportItem,
} from "@learn-workbench/shared";

interface SportLogRow {
  type: ExerciseType;
  typeLabel: string | null;
  durationSeconds: number;
  startedAt: string;
}

let catalogCache: SportItem[] | null = null;

/** 拉取运动目录（库 sport_items 优先，内置兜底），模块级缓存 */
export function useSportCatalog() {
  const [items, setItems] = useState<SportItem[]>(catalogCache ?? SPORT_CATALOG);
  useEffect(() => {
    if (catalogCache) return;
    let alive = true;
    fetch("/api/sports")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d?.items) && d.items.length > 0) {
          catalogCache = d.items as SportItem[];
          setItems(d.items);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return items;
}

type TabKey = "recent" | ExerciseType;

/**
 * 运动选择面板：分类 Tab + 项目网格（选中动态图标起舞）+ 时长 + 双模式。
 * mode="log"：首页/健康页记录用；mode="pick"：健康页选项目回调用。
 */
export function ExerciseSheet({
  open,
  onClose,
  mode = "log",
  selectedKey,
  onSelect,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  mode?: "log" | "pick";
  selectedKey?: string;
  onSelect?: (item: SportItem) => void;
  onLogged?: () => void;
}) {
  const router = useRouter();
  const pushToast = useToastStore((s) => s.push);
  const items = useSportCatalog();

  const [tab, setTab] = useState<TabKey>("recent");
  const [selected, setSelected] = useState<SportItem | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [recent, setRecent] = useState<SportItem[]>([]);
  const [logging, setLogging] = useState(false);

  // 打开时：恢复上次选中、拉取最近项目（近 14 天 distinct type_label）
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogging(false);
    fetch("/api/wellbeing/exercise?days=14")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive(d)) return;
        const seen = new Map<string, SportItem>();
        for (const log of d.logs as SportLogRow[]) {
          const label = log.typeLabel?.trim();
          if (!label || seen.has(label)) continue;
          const item = items.find((s) => s.name === label);
          if (item) seen.set(label, item);
        }
        setRecent([...seen.values()].slice(0, 6));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items]);

  const visibleItems = useMemo(() => {
    if (tab === "recent") return recent.length > 0 ? recent : items.filter((i) => i.featured);
    return items.filter((i) => i.type === tab);
  }, [tab, items, recent]);

  const current = selected ?? items.find((i) => i.key === selectedKey) ?? visibleItems[0] ?? items[0];

  const pick = useCallback(
    (item: SportItem) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setSelected(item);
      setMinutes(item.defaultMinutes);
      if (mode === "pick") {
        onSelect?.(item);
        onClose();
      }
    },
    [mode, onClose, onSelect]
  );

  const logNow = useCallback(async () => {
    if (!current || logging) return;
    setLogging(true);
    try {
      const r = await fetch("/api/wellbeing/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: current.type,
          typeLabel: current.name,
          durationSeconds: Math.round(minutes * 60),
          source: "MANUAL",
        }),
      });
      if (!r.ok) throw new Error("记录失败");
      pushToast(`${current.name} ${minutes} 分钟已记录`, "success");
      onLogged?.();
      onClose();
    } catch {
      pushToast("记录失败，请稍后重试", "error");
    } finally {
      setLogging(false);
    }
  }, [current, logging, minutes, onClose, onLogged, pushToast]);

  const startTimer = useCallback(() => {
    if (!current) return;
    const params = new URLSearchParams({
      autofocus: "exercise",
      minutes: String(minutes),
      label: current.name,
      stype: current.type,
    });
    onClose();
    router.push(`/tasks?${params.toString()}`);
  }, [current, minutes, onClose, router]);

  return (
    <GlassModal open={open} onClose={onClose} title="记录一次运动">
      {/* 分类 Tab */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <TabChip active={tab === "recent"} onClick={() => setTab("recent")}>
          最近
        </TabChip>
        {exerciseTypeOptions.map((o) => (
          <TabChip key={o.type} active={tab === o.type} onClick={() => setTab(o.type)}>
            {exerciseTypeLabels[o.type]}
          </TabChip>
        ))}
      </div>

      {/* 项目网格 */}
      <div className="mb-4 grid max-h-[38vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {visibleItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => pick(item)}
            className={`sport-tile flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${
              current?.key === item.key
                ? "border-primary/50 bg-primary/10 shadow-[0_6px_20px_-8px_rgba(47,116,192,0.4)]"
                : "border-border bg-muted/40 hover:border-primary/30 hover:bg-muted/70"
            }`}
          >
            <SportAnimatedIcon itemKey={item.key} size={38} active={current?.key === item.key} />
            <span className={`text-xs font-medium ${current?.key === item.key ? "text-primary" : "text-foreground"}`}>
              {item.name}
            </span>
          </button>
        ))}
        {visibleItems.length === 0 ? (
          <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
            这个分类下还没有常练的项目，去其他分类选一个吧
          </p>
        ) : null}
      </div>

      {/* 时长 */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock3 className="size-3.5" /> 时长
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.max(5, m - 5))}
            className="h-8 w-8 rounded-lg border border-border bg-surface text-sm font-semibold transition-colors hover:bg-muted"
          >
            −
          </button>
          <span className="min-w-14 text-center text-sm font-bold">
            {minutes}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">分钟</span>
          </span>
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.min(240, m + 5))}
            className="h-8 w-8 rounded-lg border border-border bg-surface text-sm font-semibold transition-colors hover:bg-muted"
          >
            +
          </button>
        </div>
        <div className="hidden gap-1 sm:flex">
          {[15, 30, 45, 60].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                minutes === m ? "bg-primary text-white" : "bg-muted/70 text-muted-foreground hover:bg-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 双模式操作 */}
      {mode === "log" ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startTimer}
            disabled={!current}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary-strong text-sm font-semibold text-white shadow-[0_8px_24px_rgba(47,116,192,0.3)] transition-all hover:brightness-105 disabled:opacity-60"
          >
            <Play className="size-4" /> 开始计时（全屏）
          </button>
          <button
            type="button"
            onClick={logNow}
            disabled={logging || !current}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-success/40 bg-success/10 text-sm font-semibold text-success transition-all hover:bg-success/15 disabled:opacity-60"
          >
            {logging ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} 直接记录
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">点击上方项目即可选中 · {current?.name ?? "未选择"}</p>
      )}
    </GlassModal>
  );
}

function TabChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-primary text-white shadow-[0_4px_14px_-4px_rgba(47,116,192,0.5)]"
          : "border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function alive(d: unknown): boolean {
  return !!d && typeof d === "object";
}
