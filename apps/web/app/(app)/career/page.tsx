"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CareerReadiness } from "@learn-workbench/shared/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { ProgressBar } from "@/components/base/progress/progress";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart3,
  Briefcase,
  ChevronRight,
  FileText,
  Flower,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Rocket,
} from "lucide-react";
import {
  RiArrowUpLine,
  RiBriefcaseLine,
  RiRocketLine,
  RiTrophyLine,
} from "@remixicon/react";

const RING_RADIUS = 62;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function CareerPage() {
  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/readiness", { cache: "no-store" });
      if (!response.ok) throw new Error("readiness unavailable");
      setReadiness((await response.json()) as CareerReadiness);
    } catch {
      setError("职业数据暂时没有加载出来，稍后重试或先去看看在招岗位。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 首次进入时从接口同步职业数据；loading 是外部请求的前置状态
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const dimensions = readiness?.dimensions ?? [];
  const strongest = dimensions.length
    ? dimensions.reduce((best, dimension) => (dimension.score > best.score ? dimension : best))
    : null;
  const weakest = dimensions.length
    ? dimensions.reduce((worst, dimension) => (dimension.score < worst.score ? dimension : worst))
    : null;
  const overall = readiness ? readiness.overall : null;
  const matchedJobs = readiness ? readiness.matchedJobs : null;

  const careerStats: Stat[] = [
    {
      icon: RiRocketLine,
      label: "职业准备度",
      value: overall === null ? "--" : `${overall}%`,
      delta: dimensions.length ? `${dimensions.length} 个维度` : "待评估",
      deltaColor: "neutral",
    },
    {
      icon: RiBriefcaseLine,
      label: "匹配职位",
      value: matchedJobs === null ? "--" : `${matchedJobs}`,
      delta: matchedJobs === null ? "待同步" : "在招岗位",
      deltaColor: matchedJobs && matchedJobs > 0 ? "lime" : "neutral",
    },
    {
      icon: RiTrophyLine,
      label: "最强维度",
      value: strongest ? `${strongest.score}%` : "--",
      delta: strongest?.label ?? "待评估",
      deltaColor: "neutral",
    },
    {
      icon: RiArrowUpLine,
      label: "待补强",
      value: weakest ? `${weakest.score}%` : "--",
      delta: weakest?.label ?? "待评估",
      deltaColor: "neutral",
    },
  ];

  const nextSteps = [
    {
      href: "/career/skills",
      icon: GraduationCap,
      title: weakest ? `先补「${weakest.label}」` : "搭起你的技能树",
      hint: "把岗位要求拆成可学习、可验证的技能点",
    },
    {
      href: "/career/resume",
      icon: FileText,
      title: "整理简历",
      hint: "把项目、证书和实习沉淀成可投递的版本",
    },
    {
      href: "/career/interview",
      icon: MessageSquare,
      title: "模拟面试",
      hint: "按目标岗位练习问答，并记录每次复盘",
    },
  ];

  const modules = [
    {
      href: "/career/applications",
      icon: Briefcase,
      iconClass: "text-chart-7",
      title: "我的求职",
      hint: "收藏、投递、面试跟进",
    },
    {
      href: "/career/market",
      icon: BarChart3,
      iconClass: "text-chart-4",
      title: "市场分析",
      hint: "城市 · 薪资 · 技能热度",
    },
    {
      href: "/career/skills",
      icon: GraduationCap,
      iconClass: "text-primary",
      title: "技能树",
      hint: "按岗位补齐能力",
    },
  ];

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader title="职业" description="先看清准备度和缺口，再从在招岗位里挑下一次机会" />

      {/* 招花是职业页的首要动作：先看真实岗位，再决定补什么 */}
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="icon-chip h-11 w-11 shrink-0">
            <Flower className="size-5 text-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-caption-1-medium text-muted-foreground">招花 · 在招岗位</p>
            <h2 className="mt-0.5 text-title-2-semibold">先翻岗位，再决定补哪块技能</h2>
            <p className="mt-1 text-body-medium text-muted-foreground">
              按城市、薪资和技能筛选，收藏后直接跟进投递。
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0 self-stretch sm:self-auto">
          <Link href="/jobs">
            <Flower className="size-4" /> 进入招花 <ChevronRight className="size-4" />
          </Link>
        </Button>
      </section>

      <StatCards stats={careerStats} columns={4} />

      {error ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-medium text-danger">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="size-4" /> 重新加载
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] lg:items-center lg:p-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Rocket className="size-5 shrink-0 text-primary" />
              <h2 className="text-title-2-semibold tracking-tight">
                {readiness?.targetRole ?? "目标岗位待设置"}
              </h2>
            </div>
            <p className="mt-1.5 text-body-medium text-muted-foreground">
              技能、项目、简历和面试四项的综合准备度
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {dimensions.map((dimension) => (
                <ProgressBar
                  key={dimension.key}
                  label={`${dimension.label} · ${dimension.detail}`}
                  value={dimension.score}
                  size="sm"
                />
              ))}
              {loading && !readiness ? (
                <div className="flex flex-col gap-3 py-2" aria-busy>
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-9 w-full" />
                  ))}
                </div>
              ) : null}
              {!loading && !readiness && !error ? (
                <EmptyState
                  icon={Rocket}
                  title="还没有职业数据"
                  hint="记录技能、项目和面试复盘后，这里会按维度给出准备度"
                />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90" role="img" aria-label="职业准备度">
                <circle
                  cx="75"
                  cy="75"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--color-border-button-default)"
                  strokeWidth="10"
                />
                <circle
                  cx="75"
                  cy="75"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--color-chart-4)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={RING_LENGTH * (1 - (overall ?? 0) / 100)}
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-title-1-semibold tabular-nums">
                  {overall === null ? "--" : `${overall}%`}
                </span>
                <span className="text-caption-1-medium text-muted-foreground">职业准备度</span>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/jobs">
                <Flower className="size-4" />
                {matchedJobs === null ? "看看在招岗位" : `发现 ${matchedJobs} 个匹配岗位`}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-title-3-semibold">接下来做什么</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {nextSteps.map((step) => (
            <Link key={step.href} href={step.href} className="group block h-full">
              <Card className="h-full">
                <CardContent className="flex h-full items-start gap-3 p-4">
                  <span className="icon-chip h-10 w-10 shrink-0">
                    <step.icon className="size-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline-medium">{step.title}</p>
                    <p className="mt-0.5 text-caption-1-medium text-muted-foreground">{step.hint}</p>
                  </div>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-title-3-semibold">求职工具</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link key={module.href} href={module.href} className="group block h-full">
              <Card className="h-full">
                <CardContent className="flex h-full items-center gap-3 p-4">
                  <span className="icon-chip h-10 w-10 shrink-0">
                    <module.icon className={`size-5 ${module.iconClass}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline-medium">{module.title}</p>
                    <p className="mt-0.5 text-caption-1-medium text-muted-foreground">{module.hint}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
