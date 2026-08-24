"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketAnalysis } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Loader2,
  TrendingUp,
  MapPin,
  BarChart3,
  GraduationCap,
  Briefcase,
  Layers,
  Database,
  CircleDollarSign,
  BriefcaseBusiness,
  GitBranch,
  Flower2,
} from "lucide-react";
import { CapsuleRank, TreemapChart, HistogramBars, DonutChart, BubbleQuadrant } from "@/components/market/market-charts";

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

/** 函数方向 TOP 汇总为树图：超 8 项时聚合成「其他」保证可读 */
function toTreemap(items: { label: string; count: number }[]) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  if (sorted.length <= 8) return sorted;
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8).reduce((a, s) => a + s.count, 0);
  return [...top, { label: "其他", count: rest }];
}

function CityNote(c: { avgMin: number | null; avgMax: number | null }): string | undefined {
  if (c.avgMin == null && c.avgMax == null) return undefined;
  return `均${c.avgMin ?? "—"}-${c.avgMax ?? "—"}K`;
}

export default function MarketPage() {
  const [data, setData] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/market")
      .then(async (r) => { if (!r.ok) throw new Error("市场分析加载失败"); return r.json(); })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> 正在聚合职位数据…
      </div>
    );
  }
  if (error) return <EmptyState icon={TrendingUp} title="加载失败" hint={error} />;
  if (!data || data.total === 0) {
    return <EmptyState icon={TrendingUp} title="暂无招聘数据" hint="先抓取一些职位，市场分析会随数据自动更新" />;
  }

  return (
    <div className="page-enter flex flex-col gap-5">
      {/* 顶部大标题区 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)]">
              <BarChart3 className="size-5" />
            </span>
            <Badge variant="success">市场分析</Badge>
          </div>
          <h1 className="page-title mt-3 text-2xl font-bold tracking-tight lg:text-3xl">招聘市场分析</h1>
          <p className="page-subtitle mt-1 text-sm">市场到底需要什么？—— 来自招花职位库的实时统计</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">样本 {data.total} 个职位</Badge>
          <Button asChild variant="ghost" size="sm"><Link href="/jobs"><ChevronLeft className="size-4" /> 回招花</Link></Button>
        </div>
      </div>

      {/* 第一行：岗位职能方向 —— 矩形树图（整体构成） */}
      <ChartCard icon={<Layers className="size-4 text-emerald-400" />} title="岗位职能方向分布" badge={"样本 " + data.byFunction.reduce((a, f) => a + f.count, 0) + " 个"}>
        <TreemapChart items={toTreemap(data.byFunction).map((f) => ({ label: f.label, value: f.count }))} />
      </ChartCard>

      {/* 第二行：城市 + 技能横向排名 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard icon={<MapPin className="size-4 text-sky-400" />} title="城市需求 TOP" badge={"样本 " + data.byCity.reduce((a, c) => a + c.count, 0) + " 个"}>
          <CapsuleRank items={data.byCity.map((c) => ({ label: c.city, value: c.count, note: CityNote(c) }))} />
        </ChartCard>
        <ChartCard icon={<BarChart3 className="size-4 text-indigo-400" />} title="技能热度 TOP" badge={"样本 " + data.bySkill.reduce((a, s) => a + s.count, 0) + " 个"}>
          <CapsuleRank items={data.bySkill.map((s) => ({ label: s.skill, value: s.count }))} />
        </ChartCard>
      </div>

      {/* 第三行：薪资直方图 + 学历环形 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard icon={<CircleDollarSign className="size-4 text-amber-400" />} title="薪资区间分布" badge="K/月">
          <HistogramBars items={data.salaryDist.map((s) => ({ label: s.label, value: s.count }))} />
        </ChartCard>
        <ChartCard icon={<GraduationCap className="size-4 text-violet-400" />} title="学历需求占比" badge={"共 " + data.byEducation.reduce((a, e) => a + e.count, 0) + " 个"}>
          <DonutChart items={data.byEducation.map((e) => ({ label: e.label, value: e.count }))} centerLabel="岗位" />
        </ChartCard>
      </div>

      {/* 第四行：经验 / 平台 / 岗位类型 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ChartCard icon={<Briefcase className="size-4 text-rose-400" />} title="经验年限要求" badge="应届→资深">
          <CapsuleRank items={data.byExperience.map((e) => ({ label: e.label, value: e.count }))} />
        </ChartCard>
        <ChartCard icon={<Database className="size-4 text-emerald-400" />} title="数据来源平台" badge={"共 " + data.byPlatform.reduce((a, p) => a + p.count, 0) + " 个"}>
          <DonutChart items={data.byPlatform.map((p) => ({ label: p.label, value: p.count }))} centerLabel="来源" />
        </ChartCard>
        <ChartCard icon={<BriefcaseBusiness className="size-4 text-sky-400" />} title="岗位类型占比" badge="全职/实习/外包">
          <DonutChart items={data.byJobType.map((j) => ({ label: j.label, value: j.count }))} centerLabel="类型" />
        </ChartCard>
      </div>

      {/* 第五行：薪资-技能气泡象限 */}
      <ChartCard icon={<GitBranch className="size-4 text-indigo-400" />} title="薪资-技能相关性" badge="技能平均薪资 K/月">
        <BubbleQuadrant
          items={data.skillSalary
            .filter((s) => s.avgSalary != null && s.count > 0)
            .map((s) => ({ label: s.skill, x: s.avgSalary as number, y: s.count, r: s.count }))}
          xLabel="平均薪资"
          yLabel="职位数"
        />
      </ChartCard>

      {/* 数据说明 */}
      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center gap-2">
          <Flower2 className="size-4 text-emerald-400" />
          <CardTitle className="text-sm text-foreground">关于数据</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <p>· 样本来源：招花职位库活跃招聘岗位（不含公告/考试事件），数据随抓取自动更新，缓存 60s。</p>
          <p>· 职能方向按职位标题关键词归类，已清洗公司名脏数据；平台分布来自数据源；岗位类型按标题/标签识别（全职/实习/外包/兼职）。</p>
          <p>· 薪资按 salary_max 分桶近似；薪资-技能相关性来自技能画像表（job_skill_links）JOIN 平均薪资。</p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">生成于 {data.generatedAt ? new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
