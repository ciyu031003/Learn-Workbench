"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type {
  JobCrawlerConfig,
  JobPosting,
  JobPostingListItem,
  JobSource,
  JobStats,
} from "@learn-workbench/shared";
import {
  experimentalJobSources,
  formatDateCN,
  formatRelativeTime,
  jobCategoryLabels,
  jobSourceLabel,
  SUPPORTED_CITIES,
  todayISO,
} from "@learn-workbench/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { JobCard } from "@/components/jobs/job-card";
import { JobModal } from "@/components/jobs/job-modal";
import { JobDetailPanel } from "@/components/jobs/job-detail-panel";
import { JobFilterPanel, DEFAULT_FILTERS, type JobFilterState } from "@/components/jobs/job-filter-panel";
import { ExamCalendarModal } from "@/components/jobs/exam-calendar-modal";
import { NotificationPanel } from "@/components/jobs/notification-panel";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import {
  ArrowUpDown,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Flower2,
  Landmark,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  SlidersHorizontal,
  BarChart3,
} from "lucide-react";

type JobDetail = JobPosting & { isFav: boolean };

const PAGE_SIZE = 12;
const PLATFORM_OPTIONS = Object.keys(jobSourceLabel) as unknown as JobSource[];

const GROUPS = [
  { id: "all", label: "全部", icon: "✨" },
  { id: "internet", label: "互联网", icon: "💼" },
  { id: "gongzhi", label: "考公考编", icon: "🏛" },
  { id: "yangqi", label: "央国企", icon: "🏢" },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

const SUB_GROUPS = [
  { id: "all", label: "全部" },
  { id: "gongkao", label: "公务员" },
  { id: "gongbian", label: "事业单位·军队文职" },
] as const;

function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => {
        setValue(target);
        fromRef.current = target;
      });
      return () => cancelAnimationFrame(raf);
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * eased);
      setValue(v);
      fromRef.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatValue({ value, className }: { value: string; className?: string }) {
  const m = /^(-?[\d.]+)(.*)$/.exec(value);
  const target = m ? Number(m[1]) : NaN;
  const animated = useCountUp(Number.isFinite(target) ? target : 0);
  const text = Number.isFinite(target) ? animated + (m?.[2] ?? "") : value;
  return <span className={cn("font-bold tabular-nums tracking-tight", className)}>{text}</span>;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition-all",
        active
          ? "border-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_6px_18px_rgba(16,185,129,0.32)]"
          : "border-white/20 bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function JobSkeleton() {
  return (
    <div className="grid grid-cols-1 justify-center gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass h-56 animate-pulse rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-white/15" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
            </div>
            <div className="h-5 w-20 rounded bg-white/15" />
          </div>
          <div className="mt-5 h-3 w-2/3 rounded bg-white/10" />
          <div className="mt-3 flex gap-1.5">
            <div className="h-5 w-14 rounded-full bg-white/10" />
            <div className="h-5 w-14 rounded-full bg-white/10" />
            <div className="h-5 w-14 rounded-full bg-white/10" />
          </div>
          <div className="mt-5 h-px w-full bg-white/10" />
          <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}
export default function JobsPage() {
  const pushToast = useToastStore((s) => s.push);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [platforms, setPlatforms] = useState<JobSource[]>([]);
  const [group, setGroup] = useState<GroupId>("all");
  const [sub, setSub] = useState<"all" | "gongkao" | "gongbian">("all");
  const [sort, setSort] = useState<"new" | "salary" | "deadline">("new");
  const [cities, setCities] = useState<string[]>(SUPPORTED_CITIES);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalSummary, setModalSummary] = useState<JobPostingListItem | null>(null);
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // P1：多条件筛选 + 双栏详情面板
  const [filters, setFilters] = useState<JobFilterState>({ ...DEFAULT_FILTERS });
  const [skillsDraft, setSkillsDraft] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [clustering, setClustering] = useState(false);

  const platformsKey = platforms.join(",");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const effectiveCategories = (() => {
    if (group === "all") return "";
    if (group === "internet") return "internet";
    if (group === "yangqi") return "yangqi";
    if (group === "gongzhi") return sub === "all" ? "gongkao,gongbian" : sub;
    return "";
  })();
  const showDeadlineSort = group !== "internet";

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      setSearch(next);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    async function loadMeta() {
      const [statsR, configR] = await Promise.allSettled([
        fetch("/api/jobs/stats").then(async (r) => {
          if (!r.ok) throw new Error("招聘统计加载失败");
          return (await r.json()) as JobStats;
        }),
        fetch("/api/jobs/config").then(async (r) => {
          if (!r.ok) throw new Error("招聘配置加载失败");
          return (await r.json()) as { config: JobCrawlerConfig };
        }),
      ]);
      if (!alive) return;
      if (statsR.status === "fulfilled") {
        setStats(statsR.value);
      } else {
        pushToast(statsR.reason?.message ?? "招聘统计加载失败", "error");
      }
      if (configR.status === "fulfilled") {
        setCities((prev) =>
          Array.from(new Set([...prev, ...(configR.value.config.cities ?? [])])).filter(Boolean)
        );
      } else {
        pushToast(configR.reason?.message ?? "招聘配置加载失败", "error");
      }
    }
    loadMeta();
    return () => {
      alive = false;
    };
  }, [pushToast, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (city) params.set("city", city);
    if (effectiveCategories) params.set("category", effectiveCategories);
    if (platforms.length > 0) params.set("platforms", platformsKey);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    // P1 多条件筛选
    if (filters.salaryMin != null) params.set("salaryMin", String(filters.salaryMin));
    if (filters.salaryMax != null) params.set("salaryMax", String(filters.salaryMax));
    if (filters.education.length > 0) params.set("education", filters.education.join(","));
    if (filters.experience.length > 0) params.set("experience", filters.experience.join(","));
    if (filters.publishedWithin) params.set("publishedWithin", filters.publishedWithin);
    if (filters.skills.length > 0) params.set("skills", filters.skills.join(","));
    params.set("includeSources", "1");

    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/jobs?${params.toString()}`, { signal: controller.signal });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || "职位列表加载失败");
        if (controller.signal.aborted) return;
        setJobs((data as { jobs: JobPostingListItem[]; total: number }).jobs);
        setTotal((data as { jobs: JobPostingListItem[]; total: number }).total);
        if (!city) {
          setCities((prev) => {
            const next = new Set(prev);
            (data as { jobs: JobPostingListItem[] }).jobs.forEach((job) => {
              if (job.city) next.add(job.city);
            });
            return Array.from(next).filter(Boolean);
          });
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : "职位列表加载失败";
        setError(message);
        pushToast(message, "error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [city, effectiveCategories, filters, page, platforms.length, platformsKey, pushToast, refreshKey, search, sort]);

  const runCrawler = async () => {
    setRunning(true);
    try {
      const r = await fetch("/api/jobs/run", { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "启动抓取失败");
      pushToast("抓取已启动，稍后自动刷新", "success");
      window.setTimeout(() => setRefreshKey((v) => v + 1), 1800);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "启动抓取失败", "error");
    } finally {
      setRunning(false);
    }
  };

  const openJob = async (job: JobPostingListItem) => {
    setModalSummary(job);
    setDetailJob(null);
    setDetailLoading(true);
    setDetailError(null);
    setModalOpen(true);
    try {
      const r = await fetch(`/api/jobs/${job.id}`);
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "职位详情加载失败");
      setDetailJob(data.job as JobDetail);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "职位详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleFavorite = async (id: number) => {
    setFavoriteBusyId(id);
    try {
      const r = await fetch(`/api/jobs/${id}/favorite`, { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "收藏操作失败");
      const favorited = Boolean(data?.favorited);
      setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, isFav: favorited } : job)));
      if (detailJob?.id === id) setDetailJob((prev) => (prev ? { ...prev, isFav: favorited } : prev));
      if (modalSummary?.id === id) {
        setModalSummary((prev) => (prev ? { ...prev, isFav: favorited } : prev));
      }
      pushToast(favorited ? "已收藏" : "已取消收藏", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "收藏操作失败", "error");
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const togglePlatform = (source: JobSource) => {
    setPlatforms((prev) =>
      prev.includes(source) ? prev.filter((p) => p !== source) : [...prev, source]
    );
    setPage(1);
  };

  const selectGroup = (g: GroupId) => {
    setGroup(g);
    setSub("all");
    setPage(1);
  };

  const statItems = [
    {
      label: "今日新增",
      value: stats ? `${stats.todayNew} 个` : "—",
      icon: Sparkles,
      accent: "text-emerald-400",
    },
    {
      label: "在库职位",
      value: stats ? `${stats.total} 个` : "—",
      icon: Database,
      accent: "text-cyan-400",
    },
    {
      label: "覆盖平台",
      value: stats ? `${stats.platformCount} 个` : "—",
      icon: Building2,
      accent: "text-indigo-400",
    },
    {
      label: "上次抓取",
      value: stats?.lastRun ? formatRelativeTime(stats.lastRun) : "尚未抓取",
      icon: Clock3,
      accent: "text-amber-400",
    },
  ];
  return (
    <div className="page-enter flex flex-col gap-6">
      <section className="glass relative overflow-hidden rounded-[28px] p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute right-8 top-8 hidden text-emerald-500/40 lg:block">
          <Flower2 className="size-24" strokeWidth={1.1} />
        </div>

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)]">
              <Flower2 className="size-5" />
            </span>
            <Badge variant="success">招聘信息</Badge>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/career/market"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-muted-foreground backdrop-blur-md transition-all hover:bg-white/15 hover:text-foreground"
              >
                <BarChart3 className="size-4" />
                市场分析
              </Link>
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-muted-foreground backdrop-blur-md transition-all hover:bg-white/15 hover:text-foreground"
              >
                <CalendarDays className="size-4" />
                考试日历
              </button>
              <NotificationPanel />
            </div>
          </div>
          <h1 className="mt-5 max-w-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-500 bg-clip-text text-3xl font-black tracking-tight text-transparent lg:text-4xl">
            招花 · 今日好岗
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDateCN(todayISO())} · 让好机会像花一样绽放
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <item.icon className={cn("size-3.5", item.accent)} />
                  {item.label}
                </div>
                {item.label === "上次抓取" ? (
                  <span className="mt-1 block truncate text-base font-bold tabular-nums text-foreground">
                    {item.value}
                  </span>
                ) : (
                  <StatValue value={item.value} className="mt-1 block text-lg" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => selectGroup(g.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-bold backdrop-blur-md transition-all",
                  group === g.id
                    ? "border-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_6px_18px_rgba(16,185,129,0.32)]"
                    : "border-white/20 bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                <span>{g.icon}</span>
                {g.label}
              </button>
            ))}
            {group === "gongzhi" ? (
              <div className="ml-1 flex flex-wrap items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2 py-1">
                {SUB_GROUPS.map((sg) => (
                  <button
                    key={sg.id}
                    type="button"
                    onClick={() => {
                      setSub(sg.id as never);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                      sub === sg.id
                        ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
                        : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    {sg.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索职位、公司、公告标题或标签"
                className="h-11 pl-10"
              />
            </div>
            <div className="flex rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setSort("new");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none",
                  sort === "new"
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.28)]"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                )}
              >
                <Clock3 className="size-3.5" />
                最新
              </button>
              <button
                type="button"
                onClick={() => {
                  setSort("salary");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none",
                  sort === "salary"
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.28)]"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                )}
              >
                <ArrowUpDown className="size-3.5" />
                薪资
              </button>
              {showDeadlineSort ? (
                <button
                  type="button"
                  onClick={() => {
                    setSort("deadline");
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none",
                    sort === "deadline"
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.28)]"
                      : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  )}
                >
                  <CalendarDays className="size-3.5" />
                  截止最近
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={!city} onClick={() => setCity("")}>
              全部城市
            </FilterChip>
            {cities.map((c) => (
              <FilterChip
                key={c}
                active={city === c}
                onClick={() => {
                  setCity(c);
                  setPage(1);
                }}
              >
                {c}
              </FilterChip>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip active={platforms.length === 0} onClick={() => setPlatforms([])}>
              全部来源
            </FilterChip>
            {PLATFORM_OPTIONS.map((source) => (
              <FilterChip
                key={source}
                active={platforms.includes(source)}
                onClick={() => togglePlatform(source)}
              >
                {jobSourceLabel(source)}
                {experimentalJobSources.includes(source) ? (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">实验</span>
                ) : null}
              </FilterChip>
            ))}
          </div>

          {/* P1：高级筛选（移动端折叠 / 桌面端默认展开） */}
          <div className="flex flex-col gap-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition-all",
                  showFilters || Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)))
                    ? "border-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
                    : "border-white/20 bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                高级筛选
              </button>
              <div className="flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-300">
                <span>🔁</span>
                多平台职位已自动合并去重
              </div>
              <button
                type="button"
                onClick={async () => {
                  setClustering(true);
                  try {
                    const r = await fetch("/api/jobs/cluster", { method: "POST" });
                    const d = await r.json().catch(() => null);
                    if (!r.ok) throw new Error(d?.error || "去重失败");
                    pushToast(`去重完成：${d.clusters} 簇 · 合并 ${d.merged} 条`, "success");
                    setRefreshKey((v) => v + 1);
                  } catch (e) {
                    pushToast(e instanceof Error ? e.message : "去重失败", "error");
                  } finally {
                    setClustering(false);
                  }
                }}
                disabled={clustering}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md transition-all hover:bg-white/15 hover:text-foreground disabled:opacity-50"
              >
                {clustering ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                立即去重
              </button>
            </div>

            {showFilters ? (
              <div className="flex flex-col gap-3">
                <JobFilterPanel filters={filters} onChange={(next) => { setFilters(next); setPage(1); }} compact />
                {/* 技能标签快速添加 */}
                <div className="flex items-center gap-2">
                  <Input
                    value={skillsDraft}
                    onChange={(e) => setSkillsDraft(e.target.value)}
                    placeholder="添加技能标签，如 Python / Docker，回车确认"
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = skillsDraft.trim();
                        if (v && !filters.skills.includes(v)) {
                          setFilters((prev) => ({ ...prev, skills: [...prev.skills, v] }));
                          setPage(1);
                        }
                        setSkillsDraft("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const v = skillsDraft.trim();
                      if (v && !filters.skills.includes(v)) {
                        setFilters((prev) => ({ ...prev, skills: [...prev.skills, v] }));
                        setPage(1);
                      }
                      setSkillsDraft("");
                    }}
                  >
                    添加
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="relative">
        <section className="min-w-0">
          {loading && jobs.length === 0 ? <JobSkeleton /> : null}

          {!loading && error && jobs.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="职位列表加载失败"
              hint={error}
              action={
                <Button variant="outline" onClick={() => setRefreshKey((v) => v + 1)}>
                  <RefreshCw className="size-4" />
                  重新加载
                </Button>
              }
            />
          ) : null}

          {!loading && !error && jobs.length === 0 ? (
            <EmptyState
              icon={Flower2}
              title="还没有找到合适的职位"
              hint="试试调整筛选条件，或立即抓取最新职位"
              action={
                <Button onClick={runCrawler} disabled={running}>
                  {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  立即抓取
                </Button>
              }
            />
          ) : null}

          {jobs.length > 0 ? (
            <div className="grid grid-cols-1 justify-center gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {jobs.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={index}
                  favoriteBusy={favoriteBusyId === job.id}
                  onOpen={openJob}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          ) : null}

          {loading && jobs.length > 0 ? (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在刷新职位…
            </div>
          ) : null}

          {total > PAGE_SIZE ? (
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                第 {page} / {totalPages} 页 · 共 {total} 个
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </section>

        {/* P1：右侧详情面板（桌面端列表+详情联动） */}
        <JobDetailPanel
          open={modalOpen}
          summary={modalSummary}
          detail={detailJob}
          loading={detailLoading}
          error={detailError}
          favoriteBusy={favoriteBusyId === modalSummary?.id}
          onClose={() => setModalOpen(false)}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      <JobModal
        open={modalOpen}
        summary={modalSummary}
        detail={detailJob}
        loading={detailLoading}
        error={detailError}
        favoriteBusy={favoriteBusyId === modalSummary?.id}
        onClose={() => setModalOpen(false)}
        onToggleFavorite={toggleFavorite}
      />
      <ExamCalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </div>
  );
}
