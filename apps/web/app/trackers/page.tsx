"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToastStore } from "@/store/toast-store";
import { DomainIcon } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import { Gauge, Plus, Trash2, Pencil, BarChart3 } from "lucide-react";
import { todayISO } from "@learn-workbench/shared";

interface Tracker {
  id: number;
  domain_key: string;
  name: string;
  unit: string;
  target_value: number | null;
  target_cadence: "daily" | "weekly" | null;
  color: string;
}

interface TrackerLog {
  id: number;
  tracker_id: number;
  log_date: string;
  value: number;
  note: string | null;
}

const CADENCE_LABELS: Record<string, string> = { daily: "每日", weekly: "每周" };

export default function TrackersPage() {
  const domain = useDomainStore((s) => s.current);
  const careerKey = domain?.careerKey ?? "ict";
  const pushToast = useToastStore((s) => s.push);

  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [logsByTracker, setLogsByTracker] = useState<Record<number, TrackerLog[]>>({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tracker | null>(null);
  const [form, setForm] = useState({ name: "", unit: "", targetValue: "", targetCadence: "", color: "#6366f1" });
  const [busy, setBusy] = useState(false);

  const [overview, setOverview] = useState<{ trackerCount: number; todayCount: number; todayValue: number }>({ trackerCount: 0, todayCount: 0, todayValue: 0 });

  const load = useCallback(async () => {
    try {
      const [tr, ov] = await Promise.all([
        fetch(`/api/trackers?career=${careerKey}`).then((r) => r.json()),
        fetch(`/api/domains/overview?career=${careerKey}`).then((r) => r.json()),
      ]);
      setTrackers(tr.trackers ?? []);
      setOverview(ov);
      const ids = (tr.trackers ?? []).map((t: Tracker) => t.id);
      const entries = await Promise.all(
        ids.map(async (id: number) => {
          const r = await fetch(`/api/trackers/logs?trackerId=${id}&limit=14`);
          const d = await r.json();
          return [id, d.logs ?? []] as const;
        })
      );
      setLogsByTracker(Object.fromEntries(entries));
    } catch {
      // 接口不可用时保持空态
    }
  }, [careerKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", unit: "", targetValue: "", targetCadence: "", color: domain?.color ?? "#6366f1" });
    setCreating(true);
  };

  const openEdit = (t: Tracker) => {
    setEditing(t);
    setForm({
      name: t.name,
      unit: t.unit,
      targetValue: t.target_value == null ? "" : String(t.target_value),
      targetCadence: t.target_cadence ?? "",
      color: t.color,
    });
    setCreating(true);
  };

  const saveTracker = async () => {
    if (!form.name.trim()) {
      pushToast("记录项名称不能为空", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit.trim(),
        targetValue: form.targetValue.trim() === "" ? null : Number(form.targetValue),
        targetCadence: form.targetCadence || null,
        color: form.color,
      };
      const r = editing
        ? await fetch("/api/trackers", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editing.id, ...payload }),
          })
        : await fetch("/api/trackers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ career: careerKey, ...payload }),
          });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(d?.error ?? "保存失败", "error");
        return;
      }
      pushToast(editing ? "记录项已保存" : "已创建记录项");
      setCreating(false);
      await load();
    } catch {
      pushToast("网络异常，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeTracker = async (t: Tracker) => {
    if (!window.confirm(`确定删除「${t.name}」？其下所有记录将一并删除。`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/trackers?id=${t.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(d?.error ?? "删除失败", "error");
        return;
      }
      pushToast(`已删除「${t.name}」`);
      await load();
    } catch {
      pushToast("网络异常，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const recordToday = async (trackerId: number, value: number) => {
    const today = todayISO();
    try {
      const r = await fetch("/api/trackers/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackerId, logDate: today, value }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(d?.error ?? "记录失败", "error");
        return;
      }
      pushToast("今日已记录");
      await load();
    } catch {
      pushToast("网络异常，请重试", "error");
    }
  };

  const today = todayISO();
  const totalTodayValue = overview.todayValue;
  const targetLabel = (t: Tracker) =>
    t.target_value != null ? `${CADENCE_LABELS[t.target_cadence ?? ""] ?? ""}目标 ${t.target_value}${t.unit}` : null;

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">领域记录</h1>
          <p className="page-subtitle mt-1 text-sm">单词量 · 训练量 · 阅读页数… 用一组可自定义的计量项记录每日投入</p>
          {domain ? (
            <Link href="/roadmap" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl backdrop-saturate-150 transition-colors hover:bg-white/18">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${domain.color}26`, color: domain.color }}
              >
                <DomainIcon icon={domain.icon} className="size-3.5" />
              </span>
              <span className="max-w-44 truncate">{domain.name}</span>
              <Badge variant="muted">{domain.kindLabel}</Badge>
            </Link>
          ) : null}
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 新建记录项
        </Button>
      </div>

      {trackers.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              icon={Gauge}
              title="还没有记录项"
              hint="先建一个，比如「每日单词量（个）」「羽毛球训练（分钟）」「阅读页数」"
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" /> 新建记录项
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">今日投入</p>
                  <p className="text-xs text-muted-foreground">
                    {overview.todayCount} 项已记录 · 合计 {totalTodayValue}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-semibold tabular-nums">{totalTodayValue}</span>
            </CardContent>
          </Card>

          {trackers.map((t) => {
            const logs = logsByTracker[t.id] ?? [];
            const todayLog = logs.find((l) => l.log_date === today);
            return (
              <Card key={t.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${t.color}26`, color: t.color }}
                    >
                      <Gauge className="size-4" />
                    </span>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.unit ? <Badge variant="muted">{t.unit}</Badge> : null}
                    {targetLabel(t) ? <Badge variant="outline">{targetLabel(t)}</Badge> : null}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => openEdit(t)}
                      aria-label={`编辑${t.name}`}
                      title="编辑"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => removeTracker(t)}
                      aria-label={`删除${t.name}`}
                      title="删除"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {todayLog ? (
                    <div className="flex items-center justify-between rounded-xl border border-success/25 bg-success/5 px-3 py-2.5 text-sm">
                      <span>今日已记录</span>
                      <span className="font-semibold tabular-nums">
                        {todayLog.value}{t.unit ? ` ${t.unit}` : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm">
                      <span className="text-muted-foreground">今日还没有记录</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 5, 10, 20].map((v) => (
                      <button
                        key={v}
                        onClick={() => recordToday(t.id, v)}
                        disabled={busy}
                        className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/18 disabled:opacity-60"
                      >
                        +{v}{t.unit ? ` ${t.unit}` : ""}
                      </button>
                    ))}
                  </div>
                  {logs.length > 1 ? (
                    <div className="flex flex-col gap-1.5">
                      {logs.slice(0, 7).map((l) => (
                        <div key={l.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{l.log_date}</span>
                          <span className="tabular-nums text-foreground">{l.value}{t.unit ? ` ${t.unit}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      <GlassModal open={creating} onClose={() => setCreating(false)} title={editing ? "编辑记录项" : "新建记录项"}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">名称</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="如：每日单词量 / 羽毛球训练"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">单位（可选）</label>
            <Input
              value={form.unit}
              onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
              placeholder="个 / 分钟 / 页 / 公里"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">目标值（可选）</label>
              <Input
                value={form.targetValue}
                onChange={(e) => setForm((s) => ({ ...s, targetValue: e.target.value }))}
                placeholder="如 50"
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">目标周期（可选）</label>
              <select
                value={form.targetCadence}
                onChange={(e) => setForm((s) => ({ ...s, targetCadence: e.target.value }))}
                className="glass-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md"
              >
                <option value="">不限</option>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">颜色</label>
            <div className="flex flex-wrap gap-1.5">
              {["#6366f1", "#4f46e5", "#0ea5e9", "#16a34a", "#ea580c", "#e11d48", "#7c3aed", "#f59e0b"].map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((s) => ({ ...s, color: c }))}
                  aria-label={`颜色 ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${form.color === c ? "scale-110 border-white" : "border-white/20"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>取消</Button>
            <Button onClick={saveTracker} disabled={busy || !form.name.trim()}>
              保存
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
