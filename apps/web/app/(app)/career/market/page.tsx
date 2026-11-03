"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { LazyOrdersChartCard, LazyRevenueChartCard } from "@/components/application/dashboard/lazy-chart-cards";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import {
  RiBriefcaseLine,
  RiLineChartLine,
  RiMapPinLine,
  RiMoneyCnyCircleLine,
  RiStackLine,
  RiTimeLine,
} from "@remixicon/react";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  CircleDollarSign,
  GitBranch,
  GraduationCap,
  Layers,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CapsuleRank,
  DonutChart,
  HistogramBars,
  TreemapChart,
} from "@/components/market/market-charts";
import { MarketIntelligenceFilterBar } from "@/components/market/intelligence-filter-bar";
import { PersonalMarketCard } from "@/components/market/personal-market-card";
import { MarketViewSwitcher } from "@/components/market/market-view-switcher";
import { MarketDecisionPanel } from "@/components/market/market-decision-panel";
import type {
  MarketIntelligenceFilters,
  MarketIntelligencePayload,
  MarketIntelligenceRange,
  MarketIndustryItem,
  MarketRankItem,
} from "@/lib/domains/market/intelligence";

function toParams(filters: MarketIntelligenceFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.city) params.set("city", filters.city);
  if (filters.functionKey) params.set("function", filters.functionKey);
  if (filters.industrySector) params.set("industrySector", filters.industrySector);
  if (filters.industrySubsector) params.set("industrySubsector", filters.industrySubsector);
  if (filters.seniorityBucket) params.set("seniority", filters.seniorityBucket);
  if (filters.source) params.set("source", filters.source);
  if (filters.salaryMin != null) params.set("salaryMin", String(filters.salaryMin));
  if (filters.salaryMax != null) params.set("salaryMax", String(filters.salaryMax));
  if (filters.range && filters.range !== 90) params.set("range", String(filters.range));
  return params;
}

function readInitialFilters(): MarketIntelligenceFilters {
  if (typeof window === "undefined") return { range: 90 };
  const params = new URLSearchParams(window.location.search);
  const rangeValue = params.get("range");
  const range: MarketIntelligenceRange =
    rangeValue === "7" || rangeValue === "30" || rangeValue === "90"
      ? (Number(rangeValue) as MarketIntelligenceRange)
      : 90;
  const numberOrUndefined = (value: string | null) => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    q: params.get("q") || undefined,
    city: params.get("city") || undefined,
    functionKey: params.get("function") || undefined,
    industrySector: params.get("industrySector") || undefined,
    industrySubsector: params.get("industrySubsector") || undefined,
    seniorityBucket: params.get("seniority") || undefined,
    source: params.get("source") || undefined,
    salaryMin: numberOrUndefined(params.get("salaryMin")),
    salaryMax: numberOrUndefined(params.get("salaryMax")),
    range,
  };
}

function ChartCard({
  icon,
  title,
  badge,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl", className)}>
      <CardHeader className="flex-row items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">{icon}</span>
        <CardTitle className="text-sm text-foreground">{title}</CardTitle>
        {badge ? <Badge variant="muted" className="ml-auto text-[11px]">{badge}</Badge> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}

function toTreemap(items: { label: string; value: number }[]) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= 8) return sorted;
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8).reduce((sum, item) => sum + item.value, 0);
  return [...top, { label: "其他", value: rest }];
}

function industryItems(items: MarketIndustryItem[]) {
  return items.map((item) => ({
    key: `${item.sector} / ${item.subsector}`,
    label: `${item.sector} / ${item.subsector}`,
    value: item.count,
  }));
}

function Headline({
  topFunction,
  topCity,
  topSkill,
}: {
  topFunction?: MarketRankItem;
  topCity?: MarketRankItem;
  topSkill?: MarketRankItem;
}) {
  const lines = [
    topFunction ? `需求最高的职能：${topFunction.label}（${topFunction.count} 岗）` : "",
    topCity ? `机会最多的城市：${topCity.label}（${topCity.count} 岗）` : "",
    topSkill ? `最高频技能：${topSkill.label}（${topSkill.count} 次）` : "",
  ].filter(Boolean);

  if (!lines.length) return null;
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Sparkles className="size-4 text-amber-500" />
          当前结论
        </div>
        <div className="flex flex-col gap-1">
          {lines.map((line) => (
            <p key={line} className="text-xs text-muted-foreground">{line}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const emptyDistributions: NonNullable<MarketIntelligencePayload["distributions"]> = {
  byCity: [],
  byFunction: [],
  byIndustry: [],
  bySeniority: [],
  bySalary: [],
  bySkill: [],
};

export default function MarketPage() {
  const [filters, setFilters] = useState<MarketIntelligenceFilters>(() => readInitialFilters());
  const [data, setData] = useState<MarketIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const url = new URL("/api/market/intelligence", window.location.origin);
    toParams(filters).forEach((value, key) => url.searchParams.set(key, value));
    window.history.replaceState(null, "", `${window.location.pathname}?${url.searchParams.toString()}`);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- this is the query loading state.
    setLoading(true);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("市场情报加载失败");
        return response.json();
      })
      .then((payload: MarketIntelligencePayload) => {
        if (alive) {
          setData(payload);
          setError(null);
        }
      })
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : "市场情报加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  const summary = data?.summary;
  const dist = data?.distributions ?? emptyDistributions;
  const facets = data?.facets;

  const functionRows = useMemo(
    () => dist.byFunction.map((item) => ({ label: item.label, value: item.count })),
    [dist.byFunction]
  );
  const industryRows = useMemo(
    () => industryItems(dist.byIndustry),
    [dist.byIndustry]
  );
  const topCity = dist.byCity[0];
  const topFunction = dist.byFunction[0];
  const topSkill = dist.bySkill[0];

  const marketStats: Stat[] = [
    {
      icon: RiBriefcaseLine,
      label: "职位样本",
      value: (summary?.total ?? 0).toLocaleString("zh-CN"),
      delta: `近 7 天 +${summary?.last7DaysJobs ?? 0}`,
      deltaColor: (summary?.last7DaysJobs ?? 0) > 0 ? "lime" : "neutral",
    },
    {
      icon: RiTimeLine,
      label: "近 7 天新增",
      value: `${summary?.last7DaysJobs ?? 0}`,
      delta: summary && summary.total > 0 ? `占 ${Math.round((summary.last7DaysJobs / summary.total) * 100)}%` : "暂无样本",
      deltaColor: "neutral",
    },
    {
      icon: RiMoneyCnyCircleLine,
      label: "薪资中位",
      value: summary?.medianSalary != null ? `${summary.medianSalary}K` : "--",
      delta: summary?.avgSalary != null ? `平均 ${summary.avgSalary}K` : "未披露",
      deltaColor: "neutral",
    },
    {
      icon: RiLineChartLine,
      label: "平均薪资",
      value: summary?.avgSalary != null ? `${summary.avgSalary}K` : "--",
      delta: summary?.medianSalary != null ? `中位 ${summary.medianSalary}K` : "未披露",
      deltaColor: "neutral",
    },
    {
      icon: RiMapPinLine,
      label: "覆盖城市",
      value: `${summary?.cityCount ?? 0}`,
      delta: `${summary?.skillCount ?? 0} 项技能`,
      deltaColor: "neutral",
    },
    {
      icon: RiStackLine,
      label: "技能数量",
      value: `${summary?.skillCount ?? 0}`,
      delta: `职能 ${dist.byFunction.length} 类`,
      deltaColor: "neutral",
    },
  ];

  // 薪资走势：中位 vs 平均，均来自 /api/market/intelligence 的 timeSeries
  const salaryPoints = useMemo(
    () =>
      (data?.timeSeries ?? [])
        .filter((point) => point.medianSalary != null && point.avgSalary != null)
        .map((point) => ({
          label: point.date.slice(5),
          current: point.medianSalary ?? 0,
          previous: point.avgSalary ?? 0,
        })),
    [data]
  );
  // 新增岗位：每日新增 vs 近 7 日均值（滚动派生，仍是同一组真实行情点）
  const jobPoints = useMemo(() => {
    const tail = (data?.timeSeries ?? []).slice(-14);
    return tail.map((point, index) => {
      const window = tail.slice(Math.max(0, index - 6), index + 1);
      const average = window.reduce((sum, item) => sum + item.newJobs, 0) / window.length;
      return {
        label: point.date.slice(5),
        current: point.newJobs,
        previous: Math.round(average),
      };
    });
  }, [data]);

  if (error && !data) {
    return (
      <div className="page-enter">
        <EmptyState icon={TrendingUp} title="加载失败" hint={error} />
      </div>
    );
  }

  return (
    <div className="page-enter flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-[0_8px_24px_rgba(16,185,129,0.25)]">
              <BarChart3 className="size-5" />
            </span>
            <Badge variant="success">市场情报</Badge>
          </div>
          <h1 className="page-title mt-3 text-2xl font-bold tracking-tight lg:text-3xl">招聘市场情报</h1>
          <p className="page-subtitle mt-1 text-sm">从职位库中持续拆解趋势、职能和技能机会</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/jobs">
            <ChevronLeft className="size-4" />
            回招花
          </Link>
        </Button>
      </div>

      <MarketViewSwitcher filters={filters} onApply={setFilters} />

      {data && facets ? (
        <MarketIntelligenceFilterBar
          filters={filters}
          facets={facets}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onClear={() => setFilters({ range: filters.range })}
        />
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-4" aria-busy>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-[132px] w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[344px] w-full rounded-2xl" />
        </div>
      ) : !data || !summary || summary.total === 0 ? (
        <EmptyState icon={TrendingUp} title="暂无市场数据" hint="先抓取职位后，市场情报会自动生成" />
      ) : (
        <>
          <StatCards stats={marketStats} columns={4} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LazyRevenueChartCard
              data={salaryPoints}
              title="薪资走势"
              currentLabel="薪资中位"
              previousLabel="平均薪资"
              comparisonLabel="平均"
              headlineMode="average"
              formatValue={(value) => `${Math.round(value)}K`}
              formatAxis={(value) => `${Math.round(value)}K`}
              deltaOverride={
                summary.medianSalary != null
                  ? { label: `中位 ${summary.medianSalary}K`, color: "neutral" }
                  : undefined
              }
              emptyText="所选区间暂无薪资数据"
            />
            <LazyOrdersChartCard
              data={jobPoints}
              title="每日新增岗位"
              currentLabel="当日新增"
              previousLabel="近 7 日均值"
              comparisonLabel="均值"
              formatValue={(value) => `${Math.round(value)} 岗`}
              formatAxis={(value) => `${Math.round(value)}`}
              deltaOverride={{
                label: `近 7 天 +${summary.last7DaysJobs}`,
                color: summary.last7DaysJobs > 0 ? "lime" : "neutral",
              }}
              emptyText="所选区间暂无新增岗位"
            />
          </div>

          <Headline topFunction={topFunction} topCity={topCity} topSkill={topSkill} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard icon={<Layers className="size-4 text-emerald-400" />} title="职能需求结构" badge="样本占比">
              <TreemapChart items={toTreemap(functionRows)} />
            </ChartCard>
            <ChartCard icon={<MapPin className="size-4 text-sky-400" />} title="城市机会" badge="岗位数">
              <CapsuleRank items={(dist.byCity ?? []).map((item) => ({ label: item.label, value: item.count, note: item.medianSalary != null ? `${item.medianSalary}K` : undefined }))} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard icon={<BriefcaseBusiness className="size-4 text-indigo-400" />} title="行业机会" badge="岗位数">
              <CapsuleRank items={industryRows.map((item) => ({ label: item.label, value: item.value }))} />
            </ChartCard>
            <ChartCard icon={<GraduationCap className="size-4 text-violet-400" />} title="资历要求" badge="占比">
              <DonutChart items={(dist.bySeniority ?? []).map((item) => ({ label: item.label, value: item.count }))} />
            </ChartCard>
            <ChartCard icon={<CircleDollarSign className="size-4 text-amber-400" />} title="薪资区间" badge="岗位数">
              <HistogramBars items={(dist.bySalary ?? []).map((item) => ({ label: item.label, value: item.count }))} />
            </ChartCard>
          </div>

          <ChartCard icon={<GitBranch className="size-4 text-cyan-400" />} title="高频技能" badge="标签命中">
            <CapsuleRank items={(dist.bySkill ?? []).map((item) => ({ label: item.key, value: item.count }))} />
          </ChartCard>

          <PersonalMarketCard />

          <MarketDecisionPanel
            facets={facets}
            initialCity={filters.city}
            initialFunction={filters.functionKey}
          />

          <Card className="rounded-2xl">
            <CardContent className="flex flex-col gap-1.5 px-5 py-4 text-xs text-muted-foreground">
              <p>样本来自活跃招聘岗位，排除公告与考试事件；数据随抓取自动更新。</p>
              <p>职能、行业、资历和薪资区间由历史职位回填任务与每日聚合任务维持更新。</p>
              <p className="text-[11px] text-muted-foreground/70">生成于 {new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false })}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
