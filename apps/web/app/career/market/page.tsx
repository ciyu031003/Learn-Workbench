"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketAnalysis } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ChevronLeft, Loader2, TrendingUp, MapPin, BarChart3, GraduationCap, Briefcase, Layers, Database, CircleDollarSign, Wrench, GitBranch, Flower2 } from "lucide-react";

const BAR_GRADIENTS = ["from-emerald-400 to-cyan-500","from-sky-400 to-blue-500","from-indigo-400 to-violet-500"];

function HBar({ label, value, max, color, suffix = "", valueLabel }: { label: string; value: number; max: number; color: string; suffix?: string; valueLabel?: string; }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 shrink-0 truncate text-right text-xs font-medium text-muted-foreground" title={label}>{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-white/10">
        <div className={cn("h-full rounded-md bg-gradient-to-r transition-all duration-700", color)} style={{ width: pct + "%" }} />
      </div>
      <span className="w-16 shrink-0 text-xs font-bold tabular-nums text-foreground">{valueLabel ?? value}{suffix}</span>
    </div>
  );
}

function Donut({ data, size = 132, thickness = 20 }: { data: { label: string; count: number }[]; size?: number; thickness?: number; }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const colors = ["#34d399","#38bdf8","#818cf8","#a78bfa","#f472b6","#fbbf24","#94a3b8"];
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.count / total : 0;
    const seg = { ...d, color: colors[i % colors.length], dash: frac * c, offset };
// eslint-disable-next-line react-hooks/immutability -- 纯局部累加计算（渲染期不可变规则过于严格）
    offset += frac * c;
    return seg;
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={thickness} />
        {segments.map((s) => (
          <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeLinecap="butt" strokeDasharray={s.dash + " " + c} strokeDashoffset={-s.offset} />
        ))}
      </svg>
      <div className="flex min-w-0 flex-col gap-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-bold tabular-nums text-foreground">{s.count}</span>
          </div>
        ))}
        {segments.length === 0 ? <span className="text-[11px] text-muted-foreground">暂无数据</span> : null}
      </div>
    </div>
  );
}

function Scatter({ data }: { data: { skill: string; avgSalary: number | null; count: number }[] }) {
  const W = 240, H = 96, PAD = 8;
  const values = data.filter((d) => d.avgSalary != null);
  const maxS = Math.max(1, ...values.map((d) => d.avgSalary ?? 0));
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={"0 0 " + W + " " + H} className="w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H - PAD - (H - 2 * PAD) * f} y2={H - PAD - (H - 2 * PAD) * f} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        ))}
        {values.map((d, i) => {
          const x = PAD + ((W - 2 * PAD) * (i + 0.5)) / Math.max(1, values.length);
          const y = H - PAD - ((H - 2 * PAD) * (d.avgSalary ?? 0)) / maxS;
          const r = Math.min(9, 3 + (d.count ?? 1) * 1.2);
          return (
            <g key={d.skill}>
              <circle cx={x} cy={y} r={r} fill="url(#scatterGrad)" opacity={0.85} />
              <title>{d.skill + " · 平均 " + (d.avgSalary ?? 0) + "K · " + d.count + " 个职位"}</title>
            </g>
          );
        })}
        <defs>
          <linearGradient id="scatterGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {values.slice(0, 6).map((d) => (
          <span key={d.skill} className="text-[10px] text-muted-foreground">{d.skill} <span className="font-bold text-foreground tabular-nums">{d.avgSalary}K</span></span>
        ))}
        {values.length > 6 ? <span className="text-[10px] text-muted-foreground">+{values.length - 6}…</span> : null}
      </div>
    </div>
  );
}

function ChartCard({ icon, title, badge, children, className }: { icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode; className?: string; }) {
  return (
    <Card className={cn("overflow-hidden rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.10)]", className)}>
      <CardHeader className="flex-row items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">{icon}</span>
        <CardTitle className="text-sm text-foreground">{title}</CardTitle>
        {badge ? <Badge variant="muted" className="ml-auto text-[10px]">{badge}</Badge> : null}
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

  const maxOf = (arr: { count: number }[]) => Math.max(1, ...arr.map((x) => x.count));
  const cityMax = maxOf(data.byCity);
  const skillMax = maxOf(data.bySkill);
  const fnMax = maxOf(data.byFunction);
  const salaryMax = maxOf(data.salaryDist);
  const expMax = maxOf(data.byExperience);

  return (
    <div className="page-enter flex flex-col gap-5">
      {/* 顶部大标题区（原样保留） */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">招聘市场分析</h1>
          <p className="page-subtitle mt-1 text-sm">市场到底需要什么？—— 来自招花职位库的实时统计</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">样本 {data.total} 个职位</Badge>
          <Button asChild variant="ghost" size="sm"><Link href="/jobs"><ChevronLeft className="size-4" /> 回招花</Link></Button>
        </div>
      </div>

      {/* 第一行：通栏主卡片 —— 岗位职能方向 TOP（总览模型） */}
      <ChartCard icon={<Layers className="size-4 text-emerald-400" />} title="岗位职能方向分布 TOP" badge={"样本 " + data.byFunction.reduce((a, f) => a + f.count, 0) + " 个"}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {data.byFunction.map((f, i) => (
            <HBar key={f.label} label={f.label} value={f.count} max={fnMax} color={BAR_GRADIENTS[i % 3]} suffix=" 个" />
          ))}
          {data.byFunction.length === 0 ? <p className="col-span-2 py-4 text-center text-xs text-muted-foreground">暂无职能数据（公司名脏数据已清洗）</p> : null}
        </div>
      </ChartCard>

      {/* 第二行：左右双列大卡片 —— 城市需求 + 技能热度 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard icon={<MapPin className="size-4 text-sky-400" />} title="城市需求 TOP" badge={"样本 " + data.byCity.reduce((a, c) => a + c.count, 0) + " 个"}>
          {data.byCity.map((c, i) => (
            <HBar key={c.city} label={c.city} value={c.count} max={cityMax} color={BAR_GRADIENTS[i % 3]} suffix=" 个" valueLabel={c.count + " · 均" + (c.avgMin ?? "—") + "-" + (c.avgMax ?? "—") + "K"} />
          ))}
        </ChartCard>
        <ChartCard icon={<BarChart3 className="size-4 text-indigo-400" />} title="技能热度 TOP" badge={"样本 " + data.bySkill.reduce((a, s) => a + s.count, 0) + " 个"}>
          {data.bySkill.map((s, i) => (
            <HBar key={s.skill} label={s.skill} value={s.count} max={skillMax} color={BAR_GRADIENTS[(i + 1) % 3]} />
          ))}
        </ChartCard>
      </div>

      {/* 第三行：三列等宽小卡片 —— 薪资 / 学历 / 经验 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ChartCard icon={<CircleDollarSign className="size-4 text-amber-400" />} title="薪资区间分布" badge="K/月">
          {data.salaryDist.map((s, i) => (
            <HBar key={s.label} label={s.label} value={s.count} max={salaryMax} color={BAR_GRADIENTS[i % 3]} suffix=" 个" />
          ))}
        </ChartCard>
        <ChartCard icon={<GraduationCap className="size-4 text-violet-400" />} title="学历需求占比" badge={"共 " + data.byEducation.reduce((a, e) => a + e.count, 0) + " 个"}>
          <Donut data={data.byEducation} />
        </ChartCard>
        <ChartCard icon={<Briefcase className="size-4 text-rose-400" />} title="经验年限要求" badge="应届→资深">
          {data.byExperience.map((e, i) => (
            <HBar key={e.label} label={e.label} value={e.count} max={expMax} color={BAR_GRADIENTS[(i + 2) % 3]} suffix=" 个" />
          ))}
        </ChartCard>
      </div>

      {/* 第四行：三列等宽小卡片 —— 平台 / 岗位类型 / 薪资-技能 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ChartCard icon={<Database className="size-4 text-emerald-400" />} title="数据来源平台分布" badge={"共 " + data.byPlatform.reduce((a, p) => a + p.count, 0) + " 个"}>
          <Donut data={data.byPlatform} />
        </ChartCard>
        <ChartCard icon={<Wrench className="size-4 text-sky-400" />} title="岗位类型占比" badge="全职/实习/外包">
          <Donut data={data.byJobType} />
        </ChartCard>
        <ChartCard icon={<GitBranch className="size-4 text-indigo-400" />} title="薪资-技能相关性" badge="技能平均薪资 K/月">
          <Scatter data={data.skillSalary} />
        </ChartCard>
      </div>

      {/* 数据说明 */}
      <Card className="rounded-xl">
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
