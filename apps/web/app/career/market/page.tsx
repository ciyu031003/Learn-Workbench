"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  CircleDollarSign,
  GitBranch,
  GraduationCap,
  Layers,
  Loader2,
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
import { MarketTimeSeries } from "@/components/market/market-time-series";
import { PersonalMarketCard } from "@/components/market/personal-market-card";
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
        {badge ? <Badge variant="muted" className="ml-auto text-[10px]">{badge}</Badge> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-muted/20 px-3 py-3">
      <p className="text-2xl font-black tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
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

      {data && facets ? (
        <MarketIntelligenceFilterBar
          filters={filters}
          facets={facets}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onClear={() => setFilters({ range: filters.range })}
        />
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在聚合市场数据
          </CardContent>
        </Card>
      ) : !data || !summary || summary.total === 0 ? (
        <EmptyState icon={TrendingUp} title="暂无市场数据" hint="先抓取职位后，市场情报会自动生成" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCell value={String(summary.total)} label="职位样本" />
            <StatCell value={String(summary.last7DaysJobs)} label="近 7 天新增" />
            <StatCell value={summary.medianSalary != null ? `${summary.medianSalary}K` : "--"} label="薪资中位" />
            <StatCell value={summary.avgSalary != null ? `${summary.avgSalary}K` : "--"} label="平均薪资" />
            <StatCell value={String(summary.cityCount)} label="覆盖城市" />
            <StatCell value={String(summary.skillCount)} label="技能数量" />
          </div>

          <ChartCard icon={<TrendingUp className="size-4 text-sky-400" />} title="市场时间趋势" badge={`${filters.range ?? 90} 天`}>
            <MarketTimeSeries series={data.timeSeries} />
          </ChartCard>

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
