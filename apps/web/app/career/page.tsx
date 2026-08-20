"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CareerReadiness } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";

const DIM_COLORS: Record<string, string> = {
  skill: "progress-fill",
  project: "progress-fill-accent",
  resume: "progress-fill",
  interview: "progress-fill-accent",
};

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

  return (
    <div className="page-enter flex flex-col gap-6">
      <div>
        <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">职业画像</h1>
        <p className="page-subtitle mt-1 text-sm">技能 → 项目 → 简历 → 面试，你的长期职业成长档案</p>
      </div>

      {/* 职业状态卡 */}
      <Card className="relative overflow-hidden">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Rocket className="size-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight lg:text-2xl">
                {readiness?.targetRole ?? "ICT 学习规划"}
              </h2>
            </div>
            <p className="page-subtitle mt-2 text-sm">职业准备度 —— 距离目标岗位还差多少</p>

            <div className="mt-5 flex flex-col gap-3">
              {(readiness?.dimensions ?? []).map((d) => (
                <div key={d.key} className="max-w-md">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{d.label} <span className="text-muted-foreground">· {d.detail}</span></span>
                    <span className="tabular-nums text-muted-foreground">{d.score}%</span>
                  </div>
                  <Progress value={d.score} indicatorClassName={DIM_COLORS[d.key]} />
                </div>
              ))}
              {!readiness && !error ? (
                <div className="py-4 text-sm text-muted-foreground">加载中…</div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90">
                <defs>
                  <linearGradient id="readiness-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
                <circle cx="75" cy="75" r={62} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                <circle
                  cx="75" cy="75" r={62} fill="none"
                  stroke="url(#readiness-ring-grad)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 62}
                  strokeDashoffset={2 * Math.PI * 62 * (1 - (readiness?.overall ?? 0) / 100)}
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums">{readiness?.overall ?? 0}%</span>
                <span className="text-[11px] text-muted-foreground">职业准备度</span>
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

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      {/* P2 前置模块：技能树 / 简历 / 面试 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/career/skills" className="group">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="icon-chip h-10 w-10 shrink-0">
                <GraduationCap className="size-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">技能树</p>
                <p className="text-[11px] text-muted-foreground">P2 技能体系落地</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/career/resume" className="group">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="icon-chip h-10 w-10 shrink-0">
                <FileText className="size-5 text-accent" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">简历</p>
                <p className="text-[11px] text-muted-foreground">P3 简历整理</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/career/interview" className="group">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="icon-chip h-10 w-10 shrink-0">
                <MessageSquare className="size-5 text-success" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">面试</p>
                <p className="text-[11px] text-muted-foreground">P3 模拟面试</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 学习 × 招聘 闭环说明 */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Users className="size-5 text-primary" />
          <CardTitle>学习 → 职业成长闭环</CardTitle>
          <Badge variant="muted">P0 画像 · P2 匹配 · P3 求职</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
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
  );
}
