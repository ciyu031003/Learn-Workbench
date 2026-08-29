"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { JobApplication, JobApplicationStage, JobApplicationStats } from "@learn-workbench/shared";
import {
  KANBAN_COLUMNS,
  jobApplicationStageLabels,
  jobApplicationStageColors,
} from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassModal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import {
  ArrowRight, Building2, ChevronLeft, ExternalLink, Loader2, MapPin, MessageSquare, Trash2,
} from "lucide-react";

const STAGE_ORDER: JobApplicationStage[] = [
  "favorite", "ready", "applied", "online_test", "interview1", "interview2", "offer", "hired", "closed",
];

export default function ApplicationsPage() {
  const pushToast = useToastStore((s) => s.push);
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [stats, setStats] = useState<JobApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [recordTarget, setRecordTarget] = useState<JobApplication | null>(null);
  const [recRating, setRecRating] = useState<number>(0);
  const [recNote, setRecNote] = useState("");
  const [recBusy, setRecBusy] = useState(false);
  const [attemptsByApp, setAttemptsByApp] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/jobs/applications");
      if (!r.ok) throw new Error("求职列表加载失败");
      const d = await r.json();
      setApps(d.applications ?? []);
      setStats(d.stats ?? null);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "求职列表加载失败", "error");
    } finally {
      setLoading(false);
    }
    try {
      const ar = await fetch("/api/questions/attempts");
      if (ar.ok) {
        const a = await ar.json();
        const map: Record<number, number> = {};
        for (const att of (a.attempts ?? []) as { applicationId: number | null }[]) {
          if (att.applicationId != null) map[att.applicationId] = (map[att.applicationId] ?? 0) + 1;
        }
        setAttemptsByApp(map);
      }
    } catch { /* 面试记录数非必须 */ }
  }, [pushToast]);

// eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式，P1 统一迁移）
  useEffect(() => { load(); }, [load]);

  const move = async (app: JobApplication, delta: 1 | -1) => {
    const idx = STAGE_ORDER.indexOf(app.stage);
    const next = STAGE_ORDER[idx + delta];
    if (!next) return;
    setBusyId(app.id);
    try {
      const r = await fetch(`/api/jobs/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (!r.ok) throw new Error("阶段更新失败");
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "阶段更新失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (app: JobApplication) => {
    setBusyId(app.id);
    try {
      const r = await fetch(`/api/jobs/applications/${app.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "删除失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  const setStage = async (app: JobApplication, stage: JobApplicationStage) => {
    setBusyId(app.id);
    try {
      const r = await fetch(`/api/jobs/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!r.ok) throw new Error("阶段更新失败");
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "阶段更新失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  const recordInterview = async () => {
    if (!recordTarget) return;
    setRecBusy(true);
    try {
      const r = await fetch("/api/questions/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "interview",
          applicationId: recordTarget.id,
          selfRating: recRating || null,
          note: recNote,
        }),
      });
      if (!r.ok) throw new Error("记录面试失败");
      pushToast("已记录面试", "success");
      setRecordTarget(null);
      setRecRating(0);
      setRecNote("");
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "记录面试失败", "error");
    } finally {
      setRecBusy(false);
    }
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">我的求职</h1>
          <p className="page-subtitle mt-1 text-sm">收藏 → 投递 → 笔试/面试 → Offer → 入职，全流程记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/jobs"><ChevronLeft className="size-4" /> 去招花找职位</Link>
          </Button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {STAGE_ORDER.map((s) => (
          <div key={s} className="glass rounded-xl px-3 py-2.5 text-center">
            <div className="text-lg font-black tabular-nums" style={{ color: jobApplicationStageColors[s] }}>
              {stats?.[s] ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground">{jobApplicationStageLabels[s]}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 加载求职看板…
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={ArrowRight}
          title="还没有求职记录"
          hint="在招花页打开职位详情，点击「加入求职」开始你的求职管道"
          action={
            <Button asChild><Link href="/jobs">去招花找职位</Link></Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((col) => {
            const colApps = apps.filter((a) => (col.stages as string[]).includes(a.stage));
            return (
              <div key={col.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-foreground">{col.label}</h3>
                  <Badge variant="muted">{colApps.length}</Badge>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 min-h-[120px]">
                  {colApps.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">暂无</p>
                  ) : (
                    colApps.map((app) => (
                      <div key={app.id} className="glass rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">{app.jobTitle}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="size-3" />
                              <span className="truncate">{app.jobCompany || "未知公司"}</span>
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3" />
                              {app.jobCity || "全国"}{app.jobSalary ? ` · ${app.jobSalary}` : ""}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: jobApplicationStageColors[app.stage] }}
                          >
                            {jobApplicationStageLabels[app.stage]}
                          </span>
                        </div>
                        {app.note ? (
                          <p className="mt-2 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] text-muted-foreground">{app.note}</p>
                        ) : null}
                        {(app.stage === "interview1" || app.stage === "interview2") ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => { setRecordTarget(app); setRecRating(0); setRecNote(""); }}>
                              <MessageSquare className="size-3" /> 记录面试
                            </Button>
                            {attemptsByApp[app.id] ? (
                              <Link href="/career/interview" className="text-[11px] text-sky-300 hover:underline">
                                已记录 {attemptsByApp[app.id]} 场 · 去复盘
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-2.5 flex items-center gap-1 border-t border-white/10 pt-2">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={busyId === app.id} onClick={() => move(app, -1)}>
                            ←
                          </Button>
                          <select
                            value={app.stage}
                            onChange={(e) => setStage(app, e.target.value as JobApplicationStage)}
                            className="glass-select h-7 flex-1 rounded-lg px-1.5 text-[11px]"
                          >
                            {STAGE_ORDER.map((s) => (
                              <option key={s} value={s}>{jobApplicationStageLabels[s]}</option>
                            ))}
                          </select>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={busyId === app.id} onClick={() => move(app, 1)}>
                            →
                          </Button>
                          {app.jobUrl ? (
                            <a href={app.jobUrl} target="_blank" rel="noreferrer" aria-label="查看原文" className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/15 hover:text-foreground">
                              <ExternalLink className="size-3.5" />
                            </a>
                          ) : null}
                          <button type="button" onClick={() => remove(app)} aria-label="删除记录" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GlassModal open={!!recordTarget} onClose={() => setRecordTarget(null)} title={`记录面试 · ${recordTarget?.jobTitle ?? ""}`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">自评（1-5）</label>
            <select value={recRating} onChange={(e) => setRecRating(Number(e.target.value))} className="glass-select h-9 rounded-lg px-2 text-sm">
              <option value={0}>未评分</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 分</option>)}
            </select>
          </div>
          <Textarea value={recNote} onChange={(e) => setRecNote(e.target.value)} rows={3} placeholder="复盘结论 / 待改进点…" />
          <Button onClick={recordInterview} disabled={recBusy} className="gap-2">
            {recBusy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />} 保存记录
          </Button>
        </div>
      </GlassModal>
    </div>
  );
}
