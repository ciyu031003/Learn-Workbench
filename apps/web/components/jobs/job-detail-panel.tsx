"use client";

import type { JobPosting, JobPostingListItem } from "@learn-workbench/shared";
import {
  formatRelativeTime,
  jobCategoryColors,
  jobCategoryLabels,
  jobSourceLabel,
} from "@learn-workbench/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import {
  Building2,
  ExternalLink,
  GraduationCap,
  Heart,
  Loader2,
  MapPin,
  ArrowRight,
  X,
} from "lucide-react";
import { FreshnessBadge } from "./freshness-badge";
import { deadlineText } from "./job-card";
import { JobMatchSection } from "./job-match-section";

/** 局部样式（不动 globals.css） */
const PANEL_STYLES = `
@keyframes jdp-in {
  from { opacity: 0; transform: translateX(14px) scale(0.99); }
  to   { opacity: 1; transform: none; }
}
.jdp-panel { animation: jdp-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
/* 滚动时标题与操作条各自吸住，长 JD 也能随时关掉/收藏/投递 */
.jdp-head {
  position: sticky; top: 0; z-index: 10;
  margin: -0.25rem -0.25rem 0; padding: 0.25rem 0.25rem 0.75rem;
  backdrop-filter: blur(10px);
  background: linear-gradient(to bottom, var(--glass-bg-strong) 70%, transparent);
}
.jdp-foot {
  position: sticky; bottom: 0; z-index: 10;
  margin: 0 -0.25rem -0.25rem; padding: 0.75rem 0.25rem 0.25rem;
  backdrop-filter: blur(10px);
  background: linear-gradient(to top, var(--glass-bg-strong) 72%, transparent);
}
.jdp-title-bar { display: block; height: 2px; width: 26px; border-radius: 999px; opacity: 0.75; }
@media (prefers-reduced-motion: reduce) {
  .jdp-panel { animation: none; }
}
`;

/** 薪资展示（与列表卡同一口径，避免两处不一致） */
function salaryOf(job: { salaryText?: string | null; salaryMin?: number | null; salaryMax?: number | null }): string {
  const text = job.salaryText?.trim();
  if (text) return text;
  if (job.salaryMin != null || job.salaryMax != null) {
    const min = job.salaryMin != null ? `${job.salaryMin}K` : "面议";
    const max = job.salaryMax != null ? `${job.salaryMax}K` : "";
    return max ? `${min}-${max}` : min;
  }
  return "薪资面议";
}

type JobDetail = JobPosting & { isFav: boolean };

/**
 * P1 · Web 双栏布局右侧详情面板（仅桌面端 xl 显示；窄屏沿用弹窗 JobModal）
 * 列表 + 详情联动：点击职位卡后在此展示详情，不遮挡列表。
 */
export function JobDetailPanel({
  open,
  summary,
  detail,
  loading,
  error,
  favoriteBusy,
  onClose,
  onToggleFavorite,
}: {
  open: boolean;
  summary: JobPostingListItem | null;
  detail: JobDetail | null;
  loading: boolean;
  error: string | null;
  favoriteBusy: boolean;
  onClose: () => void;
  onToggleFavorite: (id: number) => void;
}) {
  const pushToast = useToastStore((s) => s.push);
  if (!open || !summary) return null;
  const isAnnouncement = summary.channel === "announcement";
  const deadline = deadlineText(detail?.deadlineAt ?? summary.deadlineAt);
  const catColor = jobCategoryColors[summary.category as keyof typeof jobCategoryColors] ?? "#10b981";
  const catLabel = jobCategoryLabels[summary.category as keyof typeof jobCategoryLabels] ?? summary.category;
  const fav = detail?.isFav ?? summary.isFav;
  const sourceUrl = detail?.url || summary.url;
  const requirements = detail?.requirements
    ? detail.requirements.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : [];

  return (
    <aside className="glass jdp-panel fixed right-6 top-20 z-40 hidden max-h-[calc(100vh-7rem)] w-[380px] flex-col gap-4 overflow-y-auto rounded-2xl p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] 2xl:flex" aria-label="职位详情">
      <style>{PANEL_STYLES}</style>
      <div className="jdp-head">
        <span className="jdp-title-bar mb-2 block" style={{ background: `linear-gradient(90deg, ${catColor}, transparent)` }} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black leading-tight text-foreground">{detail?.title || summary.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {detail?.company || summary.company || jobSourceLabel(summary.source)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {detail?.city || summary.city || "全国"}
              </span>
            </div>
            {/* 薪资是求职决策的第一信息，详情面板此前缺失，这里补到标题正下方 */}
            {!isAnnouncement ? (
              <p className="mt-1.5 bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-xl font-black tabular-nums text-transparent">
                {salaryOf(detail ?? summary)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭详情"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-all hover:rotate-90 hover:bg-white/15 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="success" className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: catColor }} />
          {catLabel}
        </Badge>
        <Badge variant="muted">{jobSourceLabel(summary.source)}</Badge>
        {!isAnnouncement ? <FreshnessBadge job={summary} /> : null}
        {summary.clusterSources && summary.clusterSources.length > 1 ? (
          <Badge variant="accent">多来源：{summary.clusterSources.map(jobSourceLabel).join(" / ")}</Badge>
        ) : null}
      </div>

      {isAnnouncement && deadline ? (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-500 dark:text-rose-300">
          ⏰ {deadline}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="正在加载职位详情">
          <div className="shimmer h-4 w-24 overflow-hidden rounded-full bg-white/15" />
          <div className="shimmer h-3 w-full overflow-hidden rounded bg-white/10" />
          <div className="shimmer h-3 w-11/12 overflow-hidden rounded bg-white/10" />
          <div className="shimmer h-3 w-10/12 overflow-hidden rounded bg-white/10" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/15 px-3 py-3 text-sm text-foreground">{error}</p>
      ) : detail ? (
        <div className="flex flex-col gap-4 text-sm text-muted-foreground">
          <div>
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
              <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-500" />
              职位描述
            </h3>
            {detail.description ? (
              detail.description.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>暂无职位描述</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
              <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-500" />
              任职要求
            </h3>
            {requirements.length > 0 ? (
              <ul className="space-y-1.5">
                {requirements.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无任职要求</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><GraduationCap className="size-3.5" />{detail.education || "学历不限"}</span>
            <span>·</span>
            <span>发布于 {formatRelativeTime(detail.publishedAt ?? detail.fetchedAt)}</span>
          </div>
        </div>
      ) : null}

      {!isAnnouncement && detail ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <JobMatchSection jobId={summary.id} />
        </div>
      ) : null}

      <div className="jdp-foot mt-auto flex gap-2 border-t border-white/10 pt-3">
        <Button
          variant={fav ? "secondary" : "default"}
          className={cn(fav && "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300")}
          onClick={() => onToggleFavorite(summary.id)}
          disabled={favoriteBusy}
        >
          {favoriteBusy ? <Loader2 className="size-4 animate-spin" /> : <Heart className={cn("size-4", fav && "fill-current")} />}
          {fav ? "已收藏" : "收藏"}
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const r = await fetch("/api/jobs/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId: summary.id, stage: "favorite" }),
              });
              const d = await r.json().catch(() => null);
              if (!r.ok) throw new Error(d?.error || "加入失败");
              pushToast("已加入求职管道（我的求职 → 收藏）", "success");
            } catch (e) {
              pushToast(e instanceof Error ? e.message : "请先登录后再加入求职", "error");
            }
          }}
        >
          <ArrowRight className="size-4" />
          加入求职
        </Button>
        <Button
          variant="outline"
          className="ml-auto"
          onClick={() => { if (sourceUrl) window.open(sourceUrl, "_blank", "noopener,noreferrer"); }}
        >
          <ExternalLink className="size-4" />
          {isAnnouncement ? "查看官方原文" : "查看原文"}
        </Button>
      </div>
    </aside>
  );
}
