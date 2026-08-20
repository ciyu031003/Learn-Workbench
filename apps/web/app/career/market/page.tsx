"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketAnalysis } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ChevronLeft, Loader2, TrendingUp, MapPin, BarChart3, GraduationCap, Briefcase } from "lucide-react";

/** 纯 CSS 横向柱状图（P4 不引图表库） */
function HBar({
  label,
  value,
  max,
  color = "from-emerald-500 to-cyan-500",
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 truncate text-right text-xs font-medium text-muted-foreground">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-md bg-white/10">
        <div className={cn("h-full rounded-md bg-gradient-to-r transition-all duration-700", color)} style={{ width: pct + "%" }} />
      </div>
      <span className="w-14 shrink-0 text-xs font-bold tabular-nums text-foreground">{value}{suffix}</span>
    </div>
  );
}

function ChartCard({
  icon,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        {icon}
        <CardTitle className="text-sm">{title}</CardTitle>
        {badge ? <Badge variant="muted" className="ml-auto">{badge}</Badge> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}

export default function MarketPage() {
  const [data, setData] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/market")
      .then(async (r) => {
        if (!r.ok) throw new Error("市场分析加载失败");
        return r.json();
      })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const cityMax = Math.max(1, ...(data?.byCity.map((c) => c.count) ?? [1]));
  const skillMax = Math.max(1, ...(data?.bySkill.map((s) => s.count) ?? [1]));
  const salaryMax = Math.max(1, ...(data?.salaryDist.map((s) => s.count) ?? [1]));
  const eduMax = Math.max(1, ...(data?.byEducation.map((e) => e.count) ?? [1]));
  const expMax = Math.max(1, ...(data?.byExperience.map((e) => e.count) ?? [1]));

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">招聘市场分析</h1>
          <p className="page-subtitle mt-1 text-sm">市场到底需要什么？—— 来自招花职位库的实时统计</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">样本 {data?.total ?? "—"} 个职位</Badge>
          <Button asChild variant="ghost" size="sm">
            <Link href="/jobs"><ChevronLeft className="size-4" /> 回招花</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 正在聚合职位数据…
        </div>
      ) : error ? (
        <EmptyState icon={TrendingUp} title="加载失败" hint={error} />
      ) : !data || data.total === 0 ? (
        <EmptyState icon={TrendingUp} title="暂无招聘数据" hint="先抓取一些职位，市场分析会随数据自动更新" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* 城市需求 */}
          <ChartCard icon={<MapPin className="size-5 text-emerald-500" />} title="城市需求 TOP" badge="职位数">
            {data.byCity.map((c) => (
              <HBar key={c.city} label={c.city} value={c.count} max={cityMax} suffix=" 个" />
            ))}
            {data.byCity.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">暂无城市数据</p> : null}
          </ChartCard>

          {/* 技能热度 */}
          <ChartCard icon={<BarChart3 className="size-5 text-sky-500" />} title="技能热度 TOP" badge="出现次数">
            {data.bySkill.map((s) => (
              <HBar key={s.skill} label={s.skill} value={s.count} max={skillMax} color="from-sky-500 to-indigo-500" suffix="" />
            ))}
            {data.bySkill.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">暂无技能标签数据</p> : null}
          </ChartCard>

          {/* 薪资分布 */}
          <ChartCard icon={<TrendingUp className="size-5 text-amber-500" />} title="薪资分布（K/月）" badge="职位数">
            {data.salaryDist.map((s) => (
              <HBar key={s.label} label={s.label} value={s.count} max={salaryMax} color="from-amber-500 to-orange-500" suffix=" 个" />
            ))}
          </ChartCard>

          {/* 学历需求 */}
          <ChartCard icon={<GraduationCap className="size-5 text-violet-500" />} title="学历需求" badge="占比">
            {data.byEducation.map((e) => (
              <HBar key={e.label} label={e.label} value={e.count} max={eduMax} color="from-violet-500 to-purple-500" suffix="" />
            ))}
            {data.byEducation.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">暂无学历数据</p> : null}
          </ChartCard>

          {/* 经验需求 */}
          <ChartCard icon={<Briefcase className="size-5 text-rose-500" />} title="经验需求" badge="职位数">
            {data.byExperience.map((e) => (
              <HBar key={e.label} label={e.label} value={e.count} max={expMax} color="from-rose-500 to-pink-500" suffix=" 个" />
            ))}
            {data.byExperience.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">暂无经验数据</p> : null}
          </ChartCard>

          {/* 说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">关于数据</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <p>· 样本来源：招花职位库活跃招聘岗位（不含公告/考试事件），数据随抓取自动更新。</p>
              <p>· 城市/薪资为去重前统计；薪资按 salary_max 分桶近似。</p>
              <p>· 早期样本量有限，结论仅供参考，随数据积累收敛。</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">生成于 {data.generatedAt ? new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
