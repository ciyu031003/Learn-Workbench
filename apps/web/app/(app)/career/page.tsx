"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CareerReadiness } from "@learn-workbench/shared/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { ProgressBar } from "@/components/base/progress/progress";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Flower,
  GraduationCap,
  FileText,
  MessageSquare,
  ChevronRight,
  Users,
  Briefcase,
  BarChart3,
} from "lucide-react";
import {
  RiArrowUpLine,
  RiBriefcaseLine,
  RiRocketLine,
  RiTrophyLine,
} from "@remixicon/react";

export default function CareerPage() {
  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/profile/readiness")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d) setReadiness(d);
        else setError("数据库暂不可用");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const dimensions = readiness?.dimensions ?? [];
  const strongest = dimensions.length
    ? dimensions.reduce((best, dimension) => (dimension.score > best.score ? dimension : best))
    : null;
  const weakest = dimensions.length
    ? dimensions.reduce((worst, dimension) => (dimension.score < worst.score ? dimension : worst))
    : null;

  const careerStats: Stat[] = [
    {
      icon: RiRocketLine,
      label: "职业准备度",
      value: `${readiness?.overall ?? 0}%`,
      delta: dimensions.length ? `${dimensions.length} 个维度` : "待评估",
      deltaColor: "neutral",
    },
    {
      icon: RiBriefcaseLine,
      label: "匹配职位",
      value: `${readiness?.matchedJobs ?? 0}`,
      delta: "在招岗位",
      deltaColor: readiness && readiness.matchedJobs > 0 ? "lime" : "neutral",
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
      deltaColor: "rose",
    },
  ];

  const modules = [
    {
      href: "/career/applications",
      icon: Briefcase,
      iconClass: "text-chart-7",
      title: "我的求职",
      hint: "收藏 → Offer 全流程",
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
      hint: "P2 技能体系落地",
    },
    {
      href: "/career/resume",
      icon: FileText,
      iconClass: "text-accent",
      title: "简历",
      hint: "P3 简历整理",
    },
    {
      href: "/career/interview",
      icon: MessageSquare,
      iconClass: "text-success",
      title: "面试",
      hint: "P3 模拟面试",
    },
  ];

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader title="职业画像" description="技能 → 项目 → 简历 → 面试，你的长期职业成长档案" />

      {/* 职业指标条（BoardUI stat-cards，数据来自 /api/profile/readiness） */}
      <StatCards stats={careerStats} columns={4} />

      {/* 职业状态卡 + 学习闭环说明：大屏两栏，右栏不再留一条超宽文本卡 */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="overflow-hidden xl:col-span-8">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] lg:items-center lg:p-7">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Rocket className="size-5 shrink-0 text-primary" />
                <h2 className="text-title-2-semibold tracking-tight">
                  {readiness?.targetRole ?? "ICT 学习规划"}
                </h2>
              </div>
              <p className="mt-1.5 text-body-medium text-muted-foreground">职业准备度 —— 距离目标岗位还差多少</p>

              <div className="mt-5 flex flex-col gap-3">
                {dimensions.map((dimension) => (
                  <ProgressBar
                    key={dimension.key}
                    label={`${dimension.label} · ${dimension.detail}`}
                    value={dimension.score}
                    size="sm"
                  />
                ))}
                {!readiness && !error ? (
                  <div className="flex flex-col gap-3 py-2" aria-busy>
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-9 w-full" />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-3">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90">
                  <defs>
                    <linearGradient id="readiness-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-chart-9)" />
                      <stop offset="100%" stopColor="var(--color-chart-4)" />
                    </linearGradient>
                  </defs>
                  <circle cx="75" cy="75" r={62} fill="none" stroke="var(--color-border-button-default)" strokeWidth="10" />
                  <circle
                    cx="75" cy="75" r={62} fill="none"
                    stroke="url(#readiness-ring-grad)" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 62}
                    strokeDashoffset={2 * Math.PI * 62 * (1 - (readiness?.overall ?? 0) / 100)}
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-title-1-semibold tabular-nums">{readiness?.overall ?? 0}%</span>
                  <span className="text-caption-1-medium text-muted-foreground">职业准备度</span>
                </div>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/jobs">
                  <Flower className="size-4" /> 发现 {readiness?.matchedJobs ?? 0} 个适合你的职位
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader className="flex-row items-center gap-2">
            <Users className="size-5 shrink-0 text-primary" />
            <CardTitle>学习 → 职业成长闭环</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <Badge variant="muted" className="self-start">P0 画像 · P2 匹配 · P3 求职</Badge>
            <p>1. 学习路线与技能积累 → 2. 项目与 GitHub 资产 → 3. 简历完整度 → 4. 面试准备 → 5. 岗位匹配与求职。</p>
            <p>职业状态卡数据来自现有 resume_assets / topic_progress / log_entries，无需新建表即可出 MVP（规则版，P5 再上模型）。</p>
            {!readiness ? (
              <EmptyState
                icon={Rocket}
                title="暂无职业数据"
                hint="在仪表盘/日志中记录技能、项目与面试日志后，这里会呈现你的职业画像"
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      {/* 职业模块入口：2 列优先的卡片网格（大屏 3 列） */}
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
    </div>
  );
}
