"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { JobApplication, JobApplicationStage, JobApplicationStats } from "@learn-workbench/shared/schemas";
import { KANBAN_COLUMNS, jobApplicationStageLabels, jobApplicationStageColors } from "@learn-workbench/shared/labels";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassModal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import {
  ArrowRight, Building2, ChevronLeft, ExternalLink, Loader2, MapPin, MessageSquare, Trash2,
} from "lucide-react";

const STAGE_ORDER: JobApplicationStage[] = [
  "favorite", "ready", "applied", "online_test", "interview1", "interview2", "offer", "hired", "closed",
];

/** 看板局部动效（不动 globals.css） */
const BOARD_STYLES = `
@keyframes ap-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes ap-pop  { 0% { opacity: 0; transform: scale(0.82); } 100% { opacity: 1; transform: scale(1); } }
.ap-rise { animation: ap-rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
.ap-pop  { animation: ap-pop 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.ap-stat { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.ap-stat:hover { transform: translateY(-2px); box-shadow: var(--elev-2); }
.ap-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.ap-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--elev-2);
}
.ap-rail { display: block; height: 3px; width: 100%; border-radius: 999px; opacity: 0.85; }
@media (prefers-reduced-motion: reduce) {
  .ap-rise, .ap-pop { animation: none; }
  .ap-stat:hover, .ap-card:hover { transform: none; }
}
`;

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
  const [attemptsByApp, setAttemptsByApp] = useState<Record<string, number>>({});

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
    setBusyId(Number(app.id));
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
    setBusyId(Number(app.id));
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
    setBusyId(Number(app.id));
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
    <div className="page-enter flex flex-col gap-5">
      <style>{BOARD_STYLES}</style>

      <PageHeader
        title="我的求职"
        description="收藏 → 投递 → 笔试/面试 → Offer → 入职，全流程记录"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/jobs"><ChevronLeft className="size-4" /> 去招花找职位</Link>
          </Button>
        }
      />

      {/* 阶段统计：2/3 列卡片网格，9 个阶段不再拉成一条超宽横条 */}
      <section aria-label="求职阶段统计" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STAGE_ORDER.map((s, i) => {
          const color = jobApplicationStageColors[s];
          return (
            <div
              key={s}
              className="ap-stat ap-pop flex min-w-0 items-center gap-3 rounded-3xl border border-border-button-default bg-background-secondary-default px-4 py-3"
              style={{ animationDelay: `${i * 35}ms` }}
              title={`${jobApplicationStageLabels[s]}：${stats?.[s] ?? 0} 条`}
            >
              <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <div className="min-w-0">
                <div className="text-title-2-semibold tabular-nums text-text-primary">{stats?.[s] ?? 0}</div>
                <div className="truncate text-caption-1-medium text-muted-foreground">{jobApplicationStageLabels[s]}</div>
              </div>
            </div>
          );
        })}
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-body-medium text-muted-foreground">
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
            // 列色取该列首个阶段的语义色：让看板四列一眼可分，也和统计条同源
            const colColor = jobApplicationStageColors[col.stages[0] as JobApplicationStage];
            return (
              <section
                key={col.key}
                className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default"
              >
                <span className="ap-rail shrink-0" style={{ backgroundColor: colColor }} aria-hidden />
                <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
                  <h3 className="truncate text-headline-medium text-text-primary">{col.label}</h3>
                  <span
                    className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-caption-1-bold tabular-nums text-primary-foreground"
                    style={{ backgroundColor: colColor }}
                  >
                    {colApps.length}
                  </span>
                </div>
                <div className="px-3 pb-3">
                  <ScrollFade className={cn("min-h-[120px]", colApps.length > 3 && "h-[340px]")}>
                    <div className="flex flex-col gap-2 pe-1">
                      {colApps.length === 0 ? (
                        <p className="py-6 text-center text-caption-1-medium text-muted-foreground">暂无</p>
                      ) : (
                        colApps.map((app, ci) => (
                          <div
                            key={app.id}
                            className="ap-card ap-rise rounded-2xl border border-border-button-default bg-background-primary-default p-3"
                            style={{ animationDelay: `${Math.min(ci, 10) * 45}ms` }}
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-body-semibold text-text-primary">{app.jobTitle}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-caption-1-medium text-muted-foreground">
                                  <Building2 className="size-3 shrink-0" />
                                  <span className="truncate">{app.jobCompany || "未知公司"}</span>
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 text-caption-1-medium text-muted-foreground">
                                  <MapPin className="size-3 shrink-0" />
                                  <span className="truncate">{app.jobCity || "全国"}{app.jobSalary ? ` · ${app.jobSalary}` : ""}</span>
                                </p>
                              </div>
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-caption-1-bold text-primary-foreground"
                                style={{ backgroundColor: jobApplicationStageColors[app.stage] }}
                              >
                                {jobApplicationStageLabels[app.stage]}
                              </span>
                            </div>
                            {/* 流程进度：这条求职走到全流程的第几步，一眼可见 */}
                            <div className="mt-2 flex items-center gap-1.5" title={`流程进度 ${STAGE_ORDER.indexOf(app.stage) + 1}/${STAGE_ORDER.length}`}>
                              <span className="h-1 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
                                <span
                                  className="block h-full rounded-full"
                                  style={{
                                    width: `${Math.round(((STAGE_ORDER.indexOf(app.stage) + 1) / STAGE_ORDER.length) * 100)}%`,
                                    backgroundColor: jobApplicationStageColors[app.stage],
                                  }}
                                />
                              </span>
                              <span className="shrink-0 text-caption-1-medium tabular-nums text-muted-foreground">
                                {STAGE_ORDER.indexOf(app.stage) + 1}/{STAGE_ORDER.length}
                              </span>
                            </div>
                            {app.note ? (
                              <p className="mt-2 rounded-lg bg-background-tertiary-default px-2 py-1.5 text-caption-1-medium text-muted-foreground">{app.note}</p>
                            ) : null}
                            {(app.stage === "interview1" || app.stage === "interview2") ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-caption-1-medium" onClick={() => { setRecordTarget(app); setRecRating(0); setRecNote(""); }}>
                                  <MessageSquare className="size-3" /> 记录面试
                                </Button>
                                {attemptsByApp[String(app.id)] ? (
                                  <Link href="/career/interview" className="text-caption-1-medium text-primary hover:underline">
                                    已记录 {attemptsByApp[String(app.id)]} 场 · 去复盘
                                  </Link>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="mt-2.5 flex items-center gap-1 border-t border-separator-border pt-2">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-caption-1-medium" disabled={busyId === Number(app.id)} onClick={() => move(app, -1)}>
                                ←
                              </Button>
                              <select
                                value={app.stage}
                                onChange={(e) => setStage(app, e.target.value as JobApplicationStage)}
                                className="paper-select h-7 min-w-0 flex-1 rounded-lg px-1.5 text-caption-1-medium"
                              >
                                {STAGE_ORDER.map((s) => (
                                  <option key={s} value={s}>{jobApplicationStageLabels[s]}</option>
                                ))}
                              </select>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-caption-1-medium" disabled={busyId === Number(app.id)} onClick={() => move(app, 1)}>
                                →
                              </Button>
                              {app.jobUrl ? (
                                <a href={app.jobUrl} target="_blank" rel="noreferrer" aria-label="查看原文" className="rounded-lg p-1.5 text-muted-foreground hover:bg-background-tertiary-default hover:text-text-primary">
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
                  </ScrollFade>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <GlassModal open={!!recordTarget} onClose={() => setRecordTarget(null)} title={`记录面试 · ${recordTarget?.jobTitle ?? ""}`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-caption-1-medium text-muted-foreground">自评（1-5）</label>
            <select value={recRating} onChange={(e) => setRecRating(Number(e.target.value))} className="paper-select h-9 rounded-lg px-2 text-body-medium">
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
