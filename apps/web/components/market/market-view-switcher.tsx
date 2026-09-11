"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/store/toast-store";
import {
  Bookmark,
  Loader2,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import type { MarketIntelligenceFilters } from "@/lib/domains/market/intelligence";
import type { MarketSavedView } from "@/lib/domains/market/saved-views";

export function MarketViewSwitcher({
  filters,
  onApply,
}: {
  filters: MarketIntelligenceFilters;
  onApply: (filters: MarketIntelligenceFilters) => void;
}) {
  const pushToast = useToastStore((state) => state.push);
  const [views, setViews] = useState<MarketSavedView[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const response = await fetch("/api/market/views");
      if (response.status === 401) {
        setViews([]);
        return;
      }
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setViews(payload.views ?? []);
    } catch {
      setViews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial view load updates loading state.
    void load();
  }, []);

  const selected = views.find((view) => view.id === selectedId) ?? null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "操作失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = () =>
    run(async () => {
      const name = window.prompt("保存为市场视图", selected?.name ?? "我的市场视图");
      if (!name?.trim()) return;
      const response = await fetch("/api/market/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "保存失败");
      pushToast("市场视图已保存", "success");
    });

  const renameCurrent = () =>
    run(async () => {
      if (!selected) return;
      const name = window.prompt("重命名市场视图", selected.name);
      if (!name?.trim() || name === selected.name) return;
      const response = await fetch(`/api/market/views/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "重命名失败");
      pushToast("市场视图已重命名", "success");
    });

  const deleteCurrent = () =>
    run(async () => {
      if (!selected) return;
      if (!window.confirm(`删除「${selected.name}」？`)) return;
      const response = await fetch(`/api/market/views/${selected.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("删除失败");
      if (selected.id === selectedId) setSelectedId(null);
      pushToast("市场视图已删除", "success");
    });

  if (loading) {
    return (
      <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        正在加载市场视图
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Bookmark className="size-4 text-muted-foreground" />
      <select
        value={selectedId ?? ""}
        onChange={(event) => {
          const id = Number(event.target.value);
          setSelectedId(id || null);
          const view = views.find((item) => item.id === id);
          if (view) onApply(view.filters);
        }}
        className="h-9 min-w-48 rounded-xl border border-border bg-surface px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      >
        <option value="">使用已保存视图</option>
        {views.map((view) => (
          <option key={view.id} value={view.id}>{view.name}</option>
        ))}
      </select>
      <Button type="button" variant="secondary" size="sm" onClick={saveCurrent} disabled={busy}>
        <Save className="size-3.5" />
        保存当前
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={renameCurrent} disabled={!selected || busy}>
        <Pencil className="size-3.5" />
        重命名
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={deleteCurrent} disabled={!selected || busy}>
        <Trash2 className="size-3.5" />
        删除
      </Button>
    </div>
  );
}
