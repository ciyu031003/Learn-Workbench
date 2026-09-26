"use client";

import type { JobPostingListItem } from "@learn-workbench/shared";
import {
  experimentalJobSources,
  formatRelativeTime,
  jobCategoryColors,
  jobCategoryLabels,
  jobSourceLabel,
} from "@learn-workbench/shared";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRight, Building2, CalendarClock, Clock3, Heart, MapPin, Users } from "lucide-react";
import { FreshnessBadge } from "./freshness-badge";

/** 职位卡局部动效（不动 globals.css，避免与其它流的样式互相覆盖） */
const CARD_STYLES = `
@keyframes jc-heart-pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.5); }
  70%  { transform: scale(0.88); }
  100% { transform: scale(1); }
}
.jc-heart-pop { animation: jc-heart-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
/* 类别色轨：hover 时向两端"舒展"，给卡片一点性格又不喧哗 */
.jc-rail {
  position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px;
  border-radius: 0 999px 999px 0; opacity: 0.75;
  transition: top 0.24s cubic-bezier(0.22, 1, 0.36, 1), bottom 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease;
}
@media (hover: hover) {
  .job-card:hover .jc-rail { top: 6px; bottom: 6px; opacity: 1; }
}
/* 底部"查看详情"：hover / 键盘聚焦时滑入 */
.jc-cta { opacity: 0; transform: translateX(-4px); transition: opacity 0.22s ease, transform 0.22s ease; }
@media (hover: hover) {
  .job-card:hover .jc-cta { opacity: 1; transform: none; }
}
.job-card:focus-visible .jc-cta { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .jc-rail, .jc-cta { transition: none; }
  .jc-cta { opacity: 0; transform: none; }
  .job-card:hover .jc-cta, .job-card:focus-visible .jc-cta { opacity: 1; }
}
`;

const avatarGradients = [
  "from-indigo-500 to-blue-500",
  "from-emerald-500 to-cyan-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-purple-500",
];

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function salaryText(job: JobPostingListItem): string {
  const text = job.salaryText?.trim();
  if (text) return text;
  if (job.salaryMin != null || job.salaryMax != null) {
    const min = job.salaryMin != null ? `${job.salaryMin}K` : "面议";
    const max = job.salaryMax != null ? `${job.salaryMax}K` : "";
    return max ? `${min}-${max}` : min;
  }
  return "薪资面议";
}

/** 报名截止文案 */
export function deadlineText(deadlineAt: string | null): string | null {
  if (!deadlineAt) return null;
  const t = new Date(deadlineAt).getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  const days = Math.ceil((t - now) / 86400000);
  const d = new Date(t);
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (days < 0) return `已截止 ${md}`;
  if (days === 0) return `今日 ${md} 截止`;
  return `${days} 天后截止 · ${md}`;
}

export function JobCard({
  job,
  index = 0,
  favoriteBusy = false,
  onOpen,
  onToggleFavorite,
}: {
  job: JobPostingListItem;
  index?: number;
  favoriteBusy?: boolean;
  onOpen: (job: JobPostingListItem) => void;
  onToggleFavorite: (id: number) => void;
}) {
  const isAnnouncement = job.channel === "announcement";
  // 收藏成功的"心跳"反馈：只影响动画类名，不改任何回调语义
  const [heartPop, setHeartPop] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (popTimer.current) clearTimeout(popTimer.current); }, []);
  const initials = (job.company || job.title).trim().charAt(0).toUpperCase() || (isAnnouncement ? "公" : "职");
  const gradient = avatarGradients[hashText(job.company || job.title || job.source) % avatarGradients.length];
  const deadline = deadlineText(job.deadlineAt);
// eslint-disable-next-line react-hooks/purity -- 渲染期计算相对当前时间的逾期状态（既有模式）
  const overdue = job.deadlineAt ? new Date(job.deadlineAt).getTime() < Date.now() : false;
  const catColor = jobCategoryColors[job.category as keyof typeof jobCategoryColors] ?? "#10b981";
  const catLabel = jobCategoryLabels[job.category as keyof typeof jobCategoryLabels] ?? job.category;
  const recruitCount = (job.extra as Record<string, unknown>)?.recruit_count as number | undefined;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(job)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(job);
        }
      }}
      className="job-card job-card-enter glass glass-hover group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl p-4"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, ["--jc-cat" as string]: catColor }}
    >
      <span className="job-card-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
      {/* 类别色轨：公告与职位共用同一套语言，靠颜色区分招花的三条来源线 */}
      <span className="jc-rail" style={{ backgroundColor: catColor }} aria-hidden />
      <style>{CARD_STYLES}</style>

      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-lg",
            isAnnouncement ? "from-indigo-500 to-violet-600" : gradient
          )}
        >
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-base font-bold leading-snug text-foreground">{job.title}</h2>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {isAnnouncement ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: catColor }}>
                  {catLabel}
                </span>
                <MapPin className="size-3.5" />
                <span className="truncate">{job.city || "全国"}</span>
              </>
            ) : (
              <>
                <MapPin className="size-3.5" />
                <span className="truncate">
                  {job.city || "城市不限"}
                  {job.district ? ` · ${job.district}` : ""}
                </span>
              </>
            )}
          </div>
        </div>

        {isAnnouncement ? (
          deadline ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
                overdue
                  ? "bg-white/10 text-muted-foreground line-through"
                  : "bg-rose-500/15 text-rose-500 dark:text-rose-300"
              )}
            >
              {deadline}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-500 dark:text-emerald-300">
              公告
            </span>
          )
        ) : (
          <span className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-lg font-black tabular-nums text-transparent">
            {salaryText(job)}
          </span>
        )}
      </div>

      <div className="relative mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3.5 shrink-0" />
        <span className="truncate">{job.company || (isAnnouncement ? jobSourceLabel(job.source) : "公司未知")}</span>
        {!isAnnouncement ? (
          <>
            <span className="text-white/30">·</span>
            <span>{job.experience || "经验不限"}</span>
            <span className="text-white/30">·</span>
            <span>{job.education || "学历不限"}</span>
          </>
        ) : null}
      </div>

      {isAnnouncement ? (
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
          {recruitCount ? (
            <Badge variant="muted" className="inline-flex items-center gap-1 text-[10px]">
              <Users className="size-3" />
              招录 {recruitCount} 人
            </Badge>
          ) : null}
          {job.deadlineAt ? (
            <Badge variant={overdue ? "muted" : "accent"} className="inline-flex items-center gap-1 text-[10px]">
              <CalendarClock className="size-3" />
              报名截止
            </Badge>
          ) : null}
          {job.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="muted" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : job.tags.length > 0 ? (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {job.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="muted" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: catColor }} />
          {jobSourceLabel(job.source)}
          {experimentalJobSources.includes(job.source as never) ? (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
              实验
            </span>
          ) : null}
        </span>
        {!isAnnouncement ? <FreshnessBadge job={job} /> : null}
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="size-3.5" />
          {formatRelativeTime(job.publishedAt ?? job.fetchedAt)}
        </span>
        {job.clusterSources && job.clusterSources.length > 1 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-300" title="多平台发布同一职位">
            发现来源：{job.clusterSources.map(jobSourceLabel).join(" / ")}
          </span>
        ) : null}
        {job.isNew ? (
          <span className="badge-new rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-300">
            NEW
          </span>
        ) : null}
        {/* hover / 聚焦时滑入的行内 CTA，让"可点"这件事更明确 */}
        <span className="jc-cta ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold text-primary">
          查看详情
          <ArrowRight className="size-3" />
        </span>
        <button
          type="button"
          aria-label={job.isFav ? "取消收藏" : "收藏职位"}
          disabled={favoriteBusy}
          onClick={(e) => {
            e.stopPropagation();
            if (!job.isFav) {
              setHeartPop(true);
              if (popTimer.current) clearTimeout(popTimer.current);
              popTimer.current = setTimeout(() => setHeartPop(false), 440);
            }
            onToggleFavorite(job.id);
          }}
          className="rounded-lg p-1.5 text-muted-foreground transition-all hover:scale-110 hover:bg-white/15 hover:text-foreground active:scale-95 disabled:opacity-50"
        >
          <Heart className={cn("size-4", heartPop && "jc-heart-pop", job.isFav && "fill-emerald-500 text-emerald-500")} />
        </button>
      </div>
    </article>
  );
}
