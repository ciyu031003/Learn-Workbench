"use client";

import type { JobPostingListItem } from "@learn-workbench/shared";
import { jobFreshness } from "@learn-workbench/shared";
import { cn } from "@/lib/utils";

/** 职位新鲜度徽标（P1，按渠道区分：job 用发布时间，公告用截止倒计时） */
export function FreshnessBadge({
  job,
  className,
}: {
  job: Pick<JobPostingListItem, "publishedAt" | "fetchedAt" | "deadlineAt" | "channel">;
  className?: string;
}) {
  const f = jobFreshness(
    job.publishedAt ?? null,
    job.fetchedAt,
    job.deadlineAt ?? null,
    job.channel === "announcement" ? "announcement" : "job"
  );
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", f.badgeClass, className)}>
      <span aria-hidden>{f.emoji}</span>
      {f.label}
    </span>
  );
}
