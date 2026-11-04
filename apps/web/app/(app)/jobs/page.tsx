"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JobCrawlerConfig, JobPosting, JobPostingListItem, JobSource, JobStats } from "@learn-workbench/shared/schemas";
import {
  HOT_CITIES,
  SUPPORTED_CITIES,
  cityProvinceLabel,
  experimentalJobSources,
  getCitiesOfProvince,
  groupCitiesByProvince,
} from "@learn-workbench/shared/labels";
import { formatDateCN, formatRelativeTime, todayISO } from "@learn-workbench/shared/dates";
import { jobSourceLabel } from "@learn-workbench/shared/pure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, SearchInput } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
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
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Clock3,
  Database,
  Flower2,
  Landmark,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  BarChart3,
} from "lucide-react";

type JobDetail = JobPosting & { isFav: boolean };

const PAGE_SIZE = 12;
const PLATFORM_OPTIONS = Object.keys(jobSourceLabel) as unknown as JobSource[];

const GROUPS = [
  { id: "all", label: "全部", Icon: LayoutGrid },
  { id: "internet", label: "互联网", Icon: BriefcaseBusiness },
  { id: "gongzhi", label: "考公考编", Icon: Landmark },
  { id: "yangqi", label: "央国企", Icon: Building2 },
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
  return <span className={cn("tabular-nums tracking-tight", className)}>{text}</span>;
}

/** 工具条胶囊：分组 / 省份 / 城市 / 来源 / 排序共用一个语义 token 外观 */
function ToolbarChip({
  active,
  onClick,
  children,
  className,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-body-2-semibold transition-colors",
        active
          ? "border-transparent bg-accent-600 text-text-white"
          : "border-border-button-default bg-background-secondary-default text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary",
        className
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
        <div key={i} className="h-56 rounded-3xl border border-border-button-default bg-background-secondary-default p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" rounded="rounded-full" />
              <Skeleton className="h-3 w-1/2" rounded="rounded-full" />
            </div>
            <Skeleton className="h-5 w-20" rounded="rounded-full" />
          </div>
          <Skeleton className="mt-5 h-3 w-2/3" rounded="rounded-full" />
          <div className="mt-3 flex gap-1.5">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-5 w-14" rounded="rounded-full" />
            ))}
          </div>
          <Skeleton className="mt-5 h-px w-full" rounded="rounded-none" />
          <Skeleton className="mt-3 h-3 w-1/2" rounded="rounded-full" />
        </div>
      ))}
    </div>
  );
}
/** P13：一级「热门」虚拟分组 key（省名里不会出现，避免与真实省份冲突） */
const HOT_PROVINCE_KEY = "__hot__";

export default function JobsPage() {
  const pushToast = useToastStore((s) => s.push);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  // P13：城市筛选改「省份 → 城市」二级（省份只是一级分组，真正发给 API 的仍是 city）
  const [province, setProvince] = useState("");
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
  // S5-4：id 契约统一 string；前端用 === 做字符串比较
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // P1：多条件筛选 + 双栏详情面板
  const [filters, setFilters] = useState<JobFilterState>({ ...DEFAULT_FILTERS });
  const [skillsDraft, setSkillsDraft] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [clustering, setClustering] = useState(false);

  const platformsKey = platforms.join(",");
  const provinceGroups = useMemo(() => groupCitiesByProvince(cities), [cities]);
  const activeProvinceCities = useMemo(() => {
    if (province === HOT_PROVINCE_KEY) return [...HOT_CITIES];
    return provinceGroups.find((group) => group.province === province)?.cities ?? [];
  }, [province, provinceGroups]);

  /** 切换一级省份：新省份不含当前城市时连带清空城市条件，避免「省/市」错配 */
  const changeProvince = (next: string) => {
    setProvince(next);
    setCity((prev) => {
      if (!prev) return "";
      const group = next === HOT_PROVINCE_KEY ? HOT_CITIES : next ? getCitiesOfProvince(next) : [];
      return group.includes(prev) ? prev : "";
    });
    setPage(1);
  };
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

  const toggleFavorite = async (id: string) => {
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
    },
    {
      label: "在库职位",
      value: stats ? `${stats.total} 个` : "—",
      icon: Database,
    },
    {
      label: "覆盖平台",
      value: stats ? `${stats.platformCount} 个` : "—",
      icon: Building2,
    },
    {
      label: "上次抓取",
      value: stats?.lastRun ? formatRelativeTime(stats.lastRun) : "尚未抓取",
      icon: Clock3,
    },
  ];
  const sortOptions: { key: "new" | "salary" | "deadline"; label: string; Icon: typeof Clock3 }[] = [
    { key: "new", label: "最新", Icon: Clock3 },
    { key: "salary", label: "薪资", Icon: ArrowUpDown },
    { key: "deadline", label: "截止最近", Icon: CalendarDays },
  ];
  const filterCount =
    (city ? 1 : 0) +
    platforms.length +
    [
      filters.salaryMin != null,
      filters.salaryMax != null,
      filters.education.length > 0,
      filters.experience.length > 0,
      Boolean(filters.publishedWithin),
      filters.skills.length > 0,
    ].filter(Boolean).length;

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="招花 · 今日好岗"
        description={`${formatDateCN(todayISO())} · 让好机会像花一样绽放`}
        eyebrow={
          <>
            <span className="flex size-10 items-center justify-center rounded-2xl border border-border-button-default bg-background-secondary-default">
              <Flower2 className="size-5 text-foreground-icon-primary" />
            </span>
            <Badge variant="success">招聘信息</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/career/market">
                <BarChart3 className="size-4" />
                市场分析
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCalendarOpen(true)}>
              <CalendarDays className="size-4" />
              考试日历
            </Button>
            <NotificationPanel />
          </>
        }
      />

      {/* KPI：四张卡并排，替代原来 hero 里的整宽统计条 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statItems.map((item) => (
          <section
            key={item.label}
            className="flex min-w-0 flex-col gap-1 rounded-3xl border border-border-button-default bg-background-secondary-default p-4"
          >
            <div className="flex items-center gap-2 text-caption-1-medium text-text-secondary">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-background-primary-default">
                <item.icon className="size-3.5 text-foreground-icon-secondary" />
              </span>
              <span className="truncate">{item.label}</span>
            </div>
            {item.label === "上次抓取" ? (
              <span className="mt-1 block truncate text-title-3-semibold text-text-primary">{item.value}</span>
            ) : (
              <StatValue value={item.value} className="mt-1 block text-title-3-semibold text-text-primary" />
            )}
          </section>
        ))}
      </div>

      {/* 紧凑工具条：分组 + 搜索 + 排序 + 筛选 + 去重，筛选面板就地展开 */}
      <section className="rounded-3xl border border-border-button-default bg-background-primary-default p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {GROUPS.map((g) => (
              <ToolbarChip key={g.id} active={group === g.id} onClick={() => selectGroup(g.id)}>
                <g.Icon className="size-4" />
                {g.label}
              </ToolbarChip>
            ))}
            {group === "gongzhi" ? (
              <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border-button-default bg-background-secondary-default px-2 py-1">
                {SUB_GROUPS.map((sg) => (
                  <button
                    key={sg.id}
                    type="button"
                    onClick={() => {
                      setSub(sg.id as never);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-caption-1-semibold transition-colors",
                      sub === sg.id
                        ? "bg-accent-600 text-text-white"
                        : "text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary"
                    )}
                  >
                    {sg.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
              placeholder="搜索职位、公司、公告标题或标签"
              className="flex-1"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-border-button-default bg-background-secondary-default p-1">
                {sortOptions
                  .filter((s) => s.key !== "deadline" || showDeadlineSort)
                  .map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSort(s.key);
                      setPage(1);
                    }}
                    className={cn(
                      "inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-caption-1-semibold transition-colors",
                      sort === s.key
                        ? "bg-background-primary-default text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    <s.Icon className="size-3.5" />
                    {s.label}
                  </button>
                ))}
              </div>

              <ToolbarChip active={showFilters || filterCount > 0} onClick={() => setShowFilters((v) => !v)}>
                <SlidersHorizontal className="size-3.5" />
                筛选
                {filterCount > 0 ? (
                  <span className="rounded-full bg-background-primary-default/30 px-1.5 text-caption-1-bold tabular-nums">
                    {filterCount}
                  </span>
                ) : null}
                <ChevronDown className={cn("size-3.5 transition-transform", showFilters && "rotate-180")} />
              </ToolbarChip>

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
                className="inline-flex items-center gap-1.5 rounded-full border border-border-button-default bg-background-secondary-default px-3.5 py-1.5 text-body-2-semibold text-text-secondary transition-colors hover:bg-background-secondary-hover hover:text-text-primary disabled:opacity-50"
              >
                {clustering ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                立即去重
              </button>
            </div>
          </div>

          {/* 折叠面板：城市 + 来源 + 高级筛选 */}
          {showFilters ? (
            <div className="flex flex-col gap-3 border-t border-separator-border pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption-1-bold uppercase tracking-wide text-text-tertiary">城市</span>
                <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-border-button-default bg-background-secondary-default px-2.5 py-1 text-caption-1-medium text-text-secondary">
                  <RefreshCw className="size-3" /> 多平台职位已自动合并去重
                </span>
              </div>
              {/* P13：一级省份（全部 / 热门 / 各省）；选中后才出现二级城市，不再一屏铺所有城市 */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <ToolbarChip
                  active={province === "" && !city}
                  onClick={() => { setCity(""); setProvince(""); setPage(1); }}
                >
                  全部城市
                </ToolbarChip>
                <ToolbarChip active={province === HOT_PROVINCE_KEY} onClick={() => changeProvince(HOT_PROVINCE_KEY)}>
                  热门
                </ToolbarChip>
                {provinceGroups.map((pg) => (
                  <ToolbarChip
                    key={pg.province}
                    active={province === pg.province}
                    onClick={() => changeProvince(pg.province)}
                  >
                    {pg.province}
                  </ToolbarChip>
                ))}
              </div>

              {province !== "" ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption-1-bold uppercase tracking-wide text-text-tertiary">
                      {province === HOT_PROVINCE_KEY ? "热门城市" : province}
                    </span>
                    {city ? (
                      <span className="rounded-full bg-background-secondary-default px-2 py-0.5 text-caption-1-semibold text-text-secondary">
                        {cityProvinceLabel(city)}
                      </span>
                    ) : null}
                    {city ? null : (
                      <span className="text-caption-1-regular text-text-tertiary">选城市后按城市筛职位</span>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <ToolbarChip active={!city} onClick={() => { setCity(""); setPage(1); }}>不限城市</ToolbarChip>
                    {activeProvinceCities.map((c) => (
                      <ToolbarChip key={c} active={city === c} onClick={() => { setCity(c); setPage(1); }}>
                        {c}
                      </ToolbarChip>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption-1-bold uppercase tracking-wide text-text-tertiary">来源</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <ToolbarChip active={platforms.length === 0} onClick={() => setPlatforms([])}>全部来源</ToolbarChip>
                {PLATFORM_OPTIONS.map((source) => (
                  <ToolbarChip key={source} active={platforms.includes(source)} onClick={() => togglePlatform(source)}>
                    {jobSourceLabel(source)}
                    {experimentalJobSources.includes(source) ? (
                      <span className="rounded-full bg-background-primary-default/25 px-1.5 py-0.5 text-caption-2-medium">实验</span>
                    ) : null}
                  </ToolbarChip>
                ))}
              </div>

              <div className="mt-1">
                <JobFilterPanel filters={filters} onChange={(next) => { setFilters(next); setPage(1); }} compact />
              </div>
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

          {/* 结果概览：条数 / 页码 / 生效筛选，替代原来"只有翻页器才看得到总数" */}
          {jobs.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-caption-1-medium text-text-tertiary">
              <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary">
                <Flower2 className="size-3.5 text-foreground-icon-secondary" />
                找到 {total} 个职位
              </span>
              <span className="tabular-nums">第 {page} / {totalPages} 页</span>
              {filterCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-background-secondary-default px-2 py-0.5 font-bold text-text-secondary">
                  已筛 {filterCount} 项
                </span>
              ) : null}
              <span className="ms-auto hidden sm:inline">点击卡片查看详情</span>
            </div>
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
            <div className="mt-5 flex items-center justify-center gap-2 text-body-medium text-text-secondary">
              <Loader2 className="size-4 animate-spin" />
              正在刷新职位…
            </div>
          ) : null}

          {total > PAGE_SIZE ? (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-3xl border border-border-button-default bg-background-secondary-default px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                上一页
              </Button>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-body-medium tabular-nums text-text-secondary">
                  第 {page} / {totalPages} 页 · 共 {total} 个
                </span>
                {/* 页码进度轨：翻到哪儿了一眼可见 */}
                <span className="h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-background-tertiary-default">
                  <span
                    className="block h-full rounded-full bg-chart-1"
                    style={{ width: `${Math.round((page / Math.max(1, totalPages)) * 100)}%` }}
                  />
                </span>
              </div>
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
