"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useToastStore } from "@/store/toast-store";
import { DomainIcon } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import { Gauge, Plus, Trash2, Pencil, ArrowRight } from "lucide-react";
import { todayISO } from "@learn-workbench/shared/dates";

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

  const summary = [
    { label: "今日投入", value: totalTodayValue, unit: "", hint: `${overview.todayCount} 项已记录` },
    { label: "记录项", value: trackers.length, unit: "个", hint: "按领域归集" },
  ];

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="领域记录"
        description="单词量 · 训练量 · 阅读页数… 用一组可自定义的计量项记录每日投入"
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
              <span className="max-w-44 truncate text-body-2-medium text-text-secondary">{domain.name}</span>
              <Badge variant="muted">{domain.kindLabel}</Badge>
              <ArrowRight className="size-3.5 shrink-0 text-foreground-icon-tertiary" />
            </Link>
          ) : undefined
        }
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> 新建记录项
          </Button>
        }
      />

      {trackers.length === 0 ? (
        <section className="rounded-3xl border border-border-button-default bg-background-secondary-default p-4">
          <EmptyState
            icon={Gauge}
            title="还没有记录项"
            hint="先建一个，比如「每日单词量（个）」「羽毛球训练（分钟）」「阅读页数」"
            pattern="bauhaus"
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> 新建记录项
              </Button>
            }
          />
        </section>
      ) : (
        <>
          {/* 今日投入：三张 KPI 卡，不再是一条超宽横条 */}
          <div className="grid gap-4 sm:grid-cols-2">
            {summary.map((s) => (
              <section
                key={s.label}
                className="flex min-w-0 flex-col gap-1 rounded-3xl border border-border-button-default bg-background-secondary-default p-4"
              >
                <p className="text-body-medium text-text-secondary">{s.label}</p>
                <p className="text-title-1-medium tabular-nums text-text-primary">
                  {s.value}
                  {s.unit ? <span className="ms-1 text-body-medium text-text-secondary">{s.unit}</span> : null}
                </p>
                <p className="text-caption-1-regular text-text-tertiary">{s.hint}</p>
              </section>
            ))}
          </div>

          {/* 记录项：多列卡片网格，长历史留在卡内 */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trackers.map((t) => {
              const logs = logsByTracker[t.id] ?? [];
              const todayLog = logs.find((l) => l.log_date === today);
              return (
                <section
                  key={t.id}
                  className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default"
                >
                  <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${t.color}26`, color: t.color }}
                    >
                      <Gauge className="size-4" />
                    </span>
                    <h2 className="min-w-0 truncate text-headline-medium text-text-primary">{t.name}</h2>
                    {t.unit ? <Badge variant="muted">{t.unit}</Badge> : null}
                    <div className="ms-auto flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => openEdit(t)}
                        aria-label={`编辑${t.name}`}
                        title="编辑"
                        className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-foreground-icon-primary"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => removeTracker(t)}
                        aria-label={`删除${t.name}`}
                        title="删除"
                        className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-tertiary-error hover:text-foreground-icon-error"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3 px-4 pb-4">
                    {targetLabel(t) ? (
                      <span className="self-start rounded-full bg-background-secondary-default px-2 py-0.5 text-caption-1-medium text-text-secondary">
                        {targetLabel(t)}
                      </span>
                    ) : null}

                    {todayLog ? (
                      <div className="flex items-center justify-between rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-2.5 text-body-medium">
                        <span className="text-text-secondary">今日已记录</span>
                        <span className="font-semibold tabular-nums text-text-primary">
                          {todayLog.value}{t.unit ? ` ${t.unit}` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-2.5 text-body-medium">
                        <span className="text-text-tertiary">今日还没有记录</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 5, 10, 20].map((v) => (
                        <button
                          key={v}
                          onClick={() => recordToday(t.id, v)}
                          disabled={busy}
                          className="rounded-lg border border-border-button-default bg-background-secondary-default px-3 py-1.5 text-body-medium text-text-primary transition-colors hover:bg-background-secondary-hover disabled:opacity-60"
                        >
                          +{v}{t.unit ? ` ${t.unit}` : ""}
                        </button>
                      ))}
                    </div>

                    {logs.length > 1 ? (
                      <div className="flex flex-col gap-1.5 border-t border-separator-border pt-2.5">
                        {logs.slice(0, 7).map((l) => (
                          <div key={l.id} className="flex items-center justify-between text-caption-1-regular text-text-tertiary">
                            <span>{l.log_date}</span>
                            <span className="tabular-nums text-text-secondary">
                              {l.value}{t.unit ? ` ${t.unit}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <GlassModal open={creating} onClose={() => setCreating(false)} title={editing ? "编辑记录项" : "新建记录项"}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-caption-1-medium text-text-secondary">名称</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="如：每日单词量 / 羽毛球训练"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-caption-1-medium text-text-secondary">单位（可选）</label>
            <Input
              value={form.unit}
              onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
              placeholder="个 / 分钟 / 页 / 公里"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-caption-1-medium text-text-secondary">目标值（可选）</label>
              <Input
                value={form.targetValue}
                onChange={(e) => setForm((s) => ({ ...s, targetValue: e.target.value }))}
                placeholder="如 50"
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-caption-1-medium text-text-secondary">目标周期（可选）</label>
              <select
                value={form.targetCadence}
                onChange={(e) => setForm((s) => ({ ...s, targetCadence: e.target.value }))}
                className="h-10 rounded-xl border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary"
              >
                <option value="">不限</option>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-caption-1-medium text-text-secondary">颜色</label>
            <div className="flex flex-wrap gap-1.5">
              {["#6366f1", "#4f46e5", "#0ea5e9", "#16a34a", "#ea580c", "#e11d48", "#7c3aed", "#f59e0b"].map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((s) => ({ ...s, color: c }))}
                  aria-label={`颜色 ${c}`}
                  className={`size-8 rounded-full border-2 transition-transform ${form.color === c ? "scale-110 border-border-button-hover" : "border-transparent"}`}
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
