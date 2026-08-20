"use client";

import type { JobPosting, JobPostingListItem } from "@learn-workbench/shared";
import {
  experimentalJobSources,
  formatRelativeTime,
  jobCategoryColors,
  jobCategoryLabels,
  jobSourceLabel,
} from "@learn-workbench/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Building2,
  ExternalLink,
  GraduationCap,
  Heart,
  Loader2,
  MapPin,
  Share2,
  X,
} from "lucide-react";
import { FreshnessBadge } from "./freshness-badge";
import { deadlineText } from "./job-card";

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
    <aside className="glass hidden h-fit flex-col gap-4 rounded-2xl p-5 xl:flex" aria-label="职位详情">
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
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭详情"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
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
        <div className="flex flex-col gap-3">
          <div className="h-4 w-24 rounded-full bg-white/15" />
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-11/12 rounded bg-white/10" />
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

      <div className="mt-auto flex gap-2 border-t border-white/10 pt-3">
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
