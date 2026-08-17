"use client";

import type { JobPostingListItem } from "@learn-workbench/shared";
import {
  experimentalJobSources,
  formatRelativeTime,
  jobSourceLabels,
} from "@learn-workbench/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Building2, Clock3, Heart, MapPin } from "lucide-react";

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
  const initials = (job.company || job.title).trim().charAt(0).toUpperCase() || "职";
  const gradient = avatarGradients[hashText(job.company || job.title) % avatarGradients.length];

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
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <span className="job-card-glare pointer-events-none absolute inset-0 rounded-[inherit]" />

      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-lg",
            gradient
          )}
        >
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold leading-snug text-foreground">{job.title}</h2>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {job.city || "城市不限"}
              {job.district ? ` · ${job.district}` : ""}
            </span>
          </div>
        </div>

        <span className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-lg font-black tabular-nums text-transparent">
          {salaryText(job)}
        </span>
      </div>

      <div className="relative mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3.5 shrink-0" />
        <span className="truncate">{job.company || "公司未知"}</span>
        <span className="text-white/30">·</span>
        <span>{job.experience || "经验不限"}</span>
        <span className="text-white/30">·</span>
        <span>{job.education || "学历不限"}</span>
      </div>

      {job.tags.length > 0 ? (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {job.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="muted" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          {jobSourceLabels[job.source]}
          {experimentalJobSources.includes(job.source) ? (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
              实验
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="size-3.5" />
          {formatRelativeTime(job.publishedAt ?? job.fetchedAt)}
        </span>
        {job.isNew ? (
          <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-300">
            NEW
          </span>
        ) : null}
        <button
          type="button"
          aria-label={job.isFav ? "取消收藏" : "收藏职位"}
          disabled={favoriteBusy}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(job.id);
          }}
          className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-white/15 hover:text-foreground disabled:opacity-50"
        >
          <Heart className={cn("size-4", job.isFav && "fill-emerald-500 text-emerald-500")} />
        </button>
      </div>
    </article>
  );
}
