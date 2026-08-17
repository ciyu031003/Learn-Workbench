"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { JobPosting, JobPostingListItem } from "@learn-workbench/shared";
import { experimentalJobSources, formatRelativeTime, jobSourceLabels } from "@learn-workbench/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Heart,
  Loader2,
  MapPin,
  Share2,
  X,
} from "lucide-react";

type JobDetail = JobPosting & { isFav: boolean };

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

function salaryText(summary: JobPostingListItem, detail: JobDetail | null): string {
  const text = detail?.salaryText?.trim() || summary.salaryText?.trim();
  if (text) return text;
  if (detail?.salaryMin != null || detail?.salaryMax != null || summary.salaryMin != null || summary.salaryMax != null) {
    const min = detail?.salaryMin ?? summary.salaryMin;
    const max = detail?.salaryMax ?? summary.salaryMax;
    if (min != null && max != null) return `${min}K-${max}K`;
    if (min != null) return `${min}K`;
    if (max != null) return `${max}K`;
  }
  return "薪资面议";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-500" />
        {title}
      </h3>
      <div className="mt-2 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-5 space-y-4">
      <div className="h-4 w-24 rounded-full bg-white/15" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-11/12 rounded bg-white/10" />
        <div className="h-3 w-4/5 rounded bg-white/10" />
      </div>
    </div>
  );
}

export function JobModal({
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

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !summary) return null;

  const initials = (summary.company || summary.title).trim().charAt(0).toUpperCase() || "职";
  const gradient = avatarGradients[hashText(summary.company || summary.title) % avatarGradients.length];
  const fav = detail?.isFav ?? summary.isFav;
  const title = detail?.title || summary.title;
  const sourceUrl = detail?.url || summary.url;
  const requirements = detail?.requirements
    ? detail.requirements
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  return createPortal(
    <div
      className="job-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="job-modal-panel glass relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)] lg:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭详情"
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-white/15 hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="pr-8">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-base font-bold text-white shadow-lg",
                gradient
              )}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black leading-tight text-foreground">{title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" />
                  {summary.company}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {detail?.city || summary.city}
                  {detail?.district || summary.district ? ` · ${detail?.district || summary.district}` : ""}
                </span>
              </div>
            </div>
            <span className="ml-auto shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-2xl font-black tabular-nums text-transparent">
              {salaryText(summary, detail)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="success">{jobSourceLabels[summary.source]}</Badge>
            {experimentalJobSources.includes(summary.source) ? <Badge variant="accent">实验平台</Badge> : null}
            {summary.isNew ? <Badge variant="success">NEW</Badge> : null}
            <Badge variant="muted">{formatRelativeTime(detail?.publishedAt ?? summary.publishedAt ?? summary.fetchedAt)}</Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "经验", value: detail?.experience || summary.experience || "不限", icon: CalendarDays },
              { label: "学历", value: detail?.education || summary.education || "不限", icon: GraduationCap },
              { label: "城市", value: detail?.city || summary.city || "不限", icon: MapPin },
              { label: "发布", value: formatRelativeTime(detail?.publishedAt ?? summary.publishedAt ?? summary.fetchedAt), icon: CalendarDays },
            ].map((cell) => (
              <div key={cell.label} className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center backdrop-blur-md">
                <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                  <cell.icon className="size-3.5" />
                  {cell.label}
                </div>
                <div className="mt-1 truncate text-sm font-bold text-foreground">{cell.value}</div>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <DetailSkeleton />
        ) : error ? (
          <p className="mt-6 rounded-xl border border-danger/30 bg-danger/15 px-3 py-3 text-sm text-foreground">
            {error}
          </p>
        ) : detail ? (
          <>
            <Section title="职位描述">
              {detail.description ? (
                detail.description.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>暂无职位描述</p>
              )}
            </Section>

            <Section title="任职要求">
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
            </Section>

            <Section title="公司信息">
              {detail.companyInfo ? (
                <p className="whitespace-pre-wrap">{detail.companyInfo}</p>
              ) : (
                <p>暂无公司信息</p>
              )}
            </Section>
          </>
        ) : null}

        <div className="mt-6 flex gap-2 border-t border-white/10 pt-4">
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
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sourceUrl || window.location.href);
                pushToast("链接已复制，快分享给朋友吧", "success");
              } catch {
                pushToast("复制失败，请手动复制链接", "error");
              }
            }}
          >
            <Share2 className="size-4" />
            分享
          </Button>
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => {
              if (sourceUrl) window.open(sourceUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="size-4" />
            查看原文
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
