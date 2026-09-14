"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MarketAnalysis } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  Radar, MapPin, GraduationCap, Clock3, CheckCircle2, Circle, TrendingUp,
  Building2, Flame, Loader2, ExternalLink, Sparkles, Target,
} from "lucide-react";

interface RadarJob {
  jobId: number;
  title: string;
  company: string;
  city: string;
  education: string;
  salaryText: string;
  salaryBand: string;
  url: string;
  source: string;
  overall: number;
  matchedSkills: { skill: string }[];
  missingSkills: { skill: string }[];
  gapHours: number;
  deadlineAt: string | null;
  deadlineLabel: string | null;
  fromFavorite: boolean;
  fromApplication: boolean;
}

interface RadarResponse {
  mode: "batch" | "fallback";
  hasProfile: boolean;
  profileCity: string | null;
  targetRole: string | null;
  buckets: { highMatch: RadarJob[]; highValue: RadarJob[]; urgent: RadarJob[] };
  top: RadarJob[];
  counts: { candidates: number; matched: number; favorites: number; applications: number };
}

/** 匹配度环：SVG 圆环 + 中心百分比（非玻璃，保持数据可读） */
function MatchRing({ value, size = 54 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const stroke = value >= 75 ? "var(--success, #16a34a)" : value >= 55 ? "var(--primary, #2f74c0)" : "var(--muted-foreground, #94a3b8)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={5} className="text-muted/40" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">
        {value}%
      </span>
    </div>
  );
}

export default function CareerRadarPage() {
  const [radar, setRadar] = useState<RadarResponse | null>(null);
  const [market, setMarket] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = city ? `?city=${encodeURIComponent(city)}` : "";
      const [rr, mr] = await Promise.all([
        fetch(`/api/jobs/radar${qs}`),
        fetch("/api/market"),
      ]);
      if (rr.ok) setRadar(await rr.json());
      if (mr.ok) setMarket(await mr.json());
    } catch {
      // 静默：页面显示空态
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  const signalCards = market
    ? [
        { key: "total", label: "在招岗位", value: market.total.toLocaleString("zh-CN"), icon: Target },
        {
          key: "city",
          label: "最热城市",
          value: market.byCity[0] ? `${market.byCity[0].city} · ${market.byCity[0].count}` : "—",
          icon: MapPin,
        },
        {
          key: "skill",
          label: "最热技能",
          value: market.bySkill[0] ? `${market.bySkill[0].skill} · ${market.bySkill[0].count}` : "—",
          icon: Flame,
        },
        {
          key: "trend",
          label: "岗位总量环比",
          value:
            market.trend?.totalDeltaPct !== null && market.trend?.totalDeltaPct !== undefined
              ? `${market.trend.totalDeltaPct >= 0 ? "+" : ""}${market.trend.totalDeltaPct}%`
              : "—",
          icon: TrendingUp,
        },
      ]
    : [];

  const counts = radar?.counts;
  const top = radar?.top ?? [];

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2 text-2xl font-bold tracking-tight lg:text-3xl">
            <Radar className="size-6 text-primary" /> 就业雷达
          </h1>
          <p className="page-subtitle mt-1 text-sm">
            {radar?.targetRole ? `目标：${radar.targetRole}` : "今日适合你的岗位信号"}
            {radar?.profileCity ? ` · ${radar.profileCity}` : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
            placeholder="按城市筛选（回车）"
            className="h-9 w-44 rounded-xl border border-border bg-card/60 px-3 text-sm"
          />
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "刷新雷达"}
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/career/market"><TrendingUp className="size-4" /> 市场工作台</Link>
          </Button>
        </div>
      </div>

      {/* 今日就业雷达：三档信号 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: "highMatch", label: "高匹配", count: radar?.buckets.highMatch.length ?? 0, hint: "技能命中 ≥75%", tone: "text-success" },
          { key: "highValue", label: "高价值", count: radar?.buckets.highValue.length ?? 0, hint: "薪资带靠前且匹配 ≥55%", tone: "text-primary" },
          { key: "urgent", label: "即将截止", count: radar?.buckets.urgent.length ?? 0, hint: "7 天内报名截止", tone: "text-warning" },
        ].map((s) => (
          <Card key={s.key}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn("text-2xl font-extrabold tabular-nums", s.tone)}>{s.count}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{s.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {radar && radar.mode === "batch" ? (
        <p className="text-xs text-muted-foreground">
          已扫描 {counts?.candidates ?? 0} 个候选岗位（收藏 {counts?.favorites ?? 0} · 投递 {counts?.applications ?? 0}），
          其中 {counts?.matched ?? 0} 个完成画像匹配。
        </p>
      ) : null}

      {/* 岗位信号卡 */}
      {loading && top.length === 0 ? (
        <Card><CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 正在计算匹配…
        </CardContent></Card>
      ) : top.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="暂时没有可匹配的岗位"
          hint={radar?.hasProfile ? "试试调整城市筛选，或先去技能树补充你的技能画像" : "先去「我的资料」和「技能树」补全画像，雷达才能算出匹配度"}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" asChild><Link href="/career/skills">去技能树</Link></Button>
              <Button size="sm" asChild><Link href="/career/profile">完善资料</Link></Button>
            </div>
          }
        />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">岗位信号</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {top.map((j) => (
              <JobSignalCard key={j.jobId} job={j} />
            ))}
          </div>
        </section>
      )}

      {/* 市场信号（只读 /api/market，独立于匹配分） */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">市场信号</h2>
          <span className="text-[11px] text-muted-foreground">来自市场快照 · 与个人匹配分无关</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {signalCards.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-4">
              <CardContent className="p-4 text-sm text-muted-foreground">市场信号加载中…</CardContent>
            </Card>
          ) : (
            signalCards.map((s) => (
              <Card key={s.key}>
                <CardContent className="flex items-center gap-3 p-4">
                  <s.icon className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function JobSignalCard({ job }: { job: RadarJob }) {
  const matched = job.matchedSkills.slice(0, 4);
  const missing = job.missingSkills.slice(0, 4);
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex gap-4 p-5">
        <MatchRing value={job.overall} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{job.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Building2 className="size-3" />{job.company || "—"}</span>
                {job.city ? <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{job.city}</span> : null}
                {job.education ? <span className="inline-flex items-center gap-1"><GraduationCap className="size-3" />{job.education}</span> : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {job.deadlineLabel ? (
                <Badge variant="warning" className="gap-1"><Clock3 className="size-3" />{job.deadlineLabel}</Badge>
              ) : null}
              {job.fromFavorite ? <Badge variant="outline">已收藏</Badge> : null}
              {job.fromApplication ? <Badge variant="accent">已投递</Badge> : null}
            </div>
          </div>

          {job.salaryText ? <p className="text-xs font-medium text-foreground">{job.salaryText}</p> : null}

          {/* 技能命中 / 缺口 */}
          <div className="flex flex-wrap gap-1.5">
            {matched.map((s) => (
              <span key={`m-${s.skill}`} className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px]">
                <CheckCircle2 className="size-3 text-success" />{s.skill}
              </span>
            ))}
            {missing.map((s) => (
              <span key={`x-${s.skill}`} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                <Circle className="size-3" />{s.skill}
              </span>
            ))}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {job.gapHours > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Sparkles className="size-3" />缺口约 {Math.round(job.gapHours)} 小时
              </span>
            ) : null}
            <span className="ml-auto flex gap-1.5">
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/jobs?jobId=${job.jobId}`}>查看详情</Link>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href={job.url} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> 原始来源</a>
              </Button>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}