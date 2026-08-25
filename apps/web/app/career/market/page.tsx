"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  SkillMarketMap,
  CapsuleRank,
  TreemapChart,
  SalaryDistributionBand,
  DonutChart,
  type SkillMapNode,
} from "@/components/market/market-charts";
import { MarketGapsCard } from "@/components/skills/market-gaps-card";
import type { MarketAnalysis } from "@learn-workbench/shared";
import {
  ChevronLeft,
  Loader2,
  TrendingUp,
  MapPin,
  BarChart3,
  GraduationCap,
  Briefcase,
  Layers,
  CircleDollarSign,
  GitBranch,
  Flower2,
  Sparkles,
  LogIn,
} from "lucide-react";

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

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-2xl font-black tabular-nums tracking-tight lg:text-3xl">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function MarketPage() {
  const [data, setData] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [skillNodes, setSkillNodes] = useState<SkillMapNode[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/market");
        if (!r.ok) throw new Error("市场分析加载失败");
        const d: MarketAnalysis = await r.json();
        if (!alive) return;

        // 登录态：/api/profile/skills 200=已登录（含我的技能等级）
        const prof = await fetch("/api/profile/skills");
        const isLoggedIn = prof.ok;
        const levelMap = new Map<string, number>();
        const gapMap = new Map<string, { enrollable: boolean; topicId: number | null; topicTitle: string | null; estimateHours: number | null; phaseId: number | null }>();
        if (isLoggedIn) {
          const pj = await prof.json().catch(() => null);
          if (pj?.skills) pj.skills.forEach((s: { name: string; level: number }) => levelMap.set(s.name.toLowerCase(), s.level));
          const gr = await fetch("/api/skills/gaps?limit=50").then((x) => (x.ok ? x.json() : null)).catch(() => null);
          for (const g of gr?.gaps ?? []) {
            gapMap.set(((g.skill ?? "") as string).toLowerCase(), {
              enrollable: !!g.enrollable,
              topicId: g.topicId ?? null,
              topicTitle: g.topicTitle ?? null,
              estimateHours: g.estimateHours ?? null,
              phaseId: g.phaseId ?? null,
            });
          }
        }

        const nodes: SkillMapNode[] = (d.skillSalary ?? [])
          .map((s) => {
            const key = (s.skill ?? "").toLowerCase();
            const gap = gapMap.get(key);
            return {
              skill: s.skill,
              avgSalary: s.avgSalary,
              count: s.count,
              myLevel: levelMap.get(key) ?? null,
              enrollable: gap?.enrollable ?? false,
              topicId: gap?.topicId ?? null,
              topicTitle: gap?.topicTitle ?? null,
              estimateHours: gap?.estimateHours ?? null,
              phaseId: gap?.phaseId ?? null,
            };
          })
          .filter((n) => n.avgSalary != null && n.count > 0);

        if (alive) {
          setData(d);
          setLoggedIn(isLoggedIn);
          setSkillNodes(nodes);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /** 规则驱动市场洞察：全部由 data 计算得出，禁止静态文案 */
  const insightData = useMemo(() => {
    if (!data) return { quadrants: [] as { key: string; label: string; hint: string; color: string; skills: string[] }[], headlines: [] as string[] };
    const salarySkills = (data.skillSalary ?? []).filter((s) => s.avgSalary != null && s.count > 0);
    const counts = salarySkills.map((s) => s.count).sort((a, b) => a - b);
    const medCount = counts[Math.floor(counts.length / 2)] ?? 0;
    const sals = salarySkills.map((s) => s.avgSalary as number).sort((a, b) => a - b);
    const medSal = sals[Math.floor(sals.length / 2)] ?? 0;

    const inQuad = (highCount: boolean, highSal: boolean) =>
      salarySkills
        .filter((s) => (s.count >= medCount) === highCount && ((s.avgSalary as number) >= medSal) === highSal)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((s) => s.skill);

    const quadrants = [
      { key: "star", label: "明星技能", hint: "高需求+高薪，优先学", color: "#6366f1", skills: inQuad(true, true) },
      { key: "potential", label: "潜力技能", hint: "高薪但需求尚小，关注长期", color: "#8b5cf6", skills: inQuad(false, true) },
      { key: "basic", label: "基础技能", hint: "需求大、薪资适中，必备", color: "#0ea5e9", skills: inQuad(true, false) },
      { key: "longtail", label: "长尾技能", hint: "需求少，附加价值有限", color: "#94a3b8", skills: inQuad(false, false) },
    ];

    const headlines: string[] = [];
    if (data.byFunction[0]) headlines.push(`需求最高的职能方向：「${data.byFunction[0].label}」（${data.byFunction[0].count} 岗）`);
    const topCity = data.byCity[0];
    if (topCity) headlines.push(`机会最多的城市：「${topCity.city}」（${topCity.count} 岗）${topCity.avgMin != null ? `，均薪 ${topCity.avgMin}-${topCity.avgMax}K` : ""}`);
    if (data.bySkill[0]) headlines.push(`最高频技能：「${data.bySkill[0].skill}」（${data.bySkill[0].count} 次）`);
    const highSal = [...salarySkills].sort((a, b) => (b.avgSalary ?? 0) - (a.avgSalary ?? 0))[0];
    if (highSal) headlines.push(`平均薪资最高：「${highSal.skill}」（${highSal.avgSalary}K/月）`);

    return { quadrants, headlines };
  }, [data]);

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

  const ov = data.overview ?? null;

  return (
    <div className="page-enter flex flex-col gap-6">
      {/* ===== 页头 ===== */}
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

      {/* ===== 市场概览（KPI，真实可算） ===== */}
      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" /> 市场概览
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell value={String(data.total)} label="职位样本" />
            <StatCell value={String(ov?.cityCount ?? data.byCity.length)} label="覆盖城市" />
            <StatCell value={String(ov?.skillCount ?? data.bySkill.length)} label="热门技能" />
            <StatCell value={ov?.avgSalary != null ? `${ov.avgSalary}K` : "—"} label="平均薪资" />
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            数据随抓取自动更新，缓存约 60s；{data.generatedAt ? `生成于 ${new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false })}` : "更新时间未知"}
          </p>
        </CardContent>
      </Card>

      {/* ===== 01 市场需求 ===== */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">01 · 市场需求</h2>
        <ChartCard icon={<Layers className="size-4 text-emerald-400" />} title="岗位职能方向分布" badge={"样本 " + data.byFunction.reduce((a, f) => a + f.count, 0) + " 个"}>
          <TreemapChart items={toTreemap(data.byFunction).map((f) => ({ label: f.label, value: f.count }))} />
        </ChartCard>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard icon={<MapPin className="size-4 text-sky-400" />} title="城市机会" badge={"样本 " + data.byCity.reduce((a, c) => a + c.count, 0) + " 个"}>
            <CapsuleRank items={data.byCity.map((c) => ({ label: c.city, value: c.count, note: CityNote(c) }))} />
          </ChartCard>
          <ChartCard icon={<CircleDollarSign className="size-4 text-amber-400" />} title="薪资区间分布" badge="K/月">
            <SalaryDistributionBand items={data.salaryDist} avgSalary={ov?.avgSalary ?? null} medianSalary={ov?.medianSalary ?? null} />
          </ChartCard>
        </div>
      </section>

      {/* ===== 02 技能机会 ===== */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">02 · 技能机会</h2>
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="flex-row items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><GitBranch className="size-4 text-indigo-400" /></span>
            <CardTitle className="text-sm text-foreground">技能市场地图</CardTitle>
            <Badge variant="muted" className="ml-auto text-[10px]">哪些技能值得学习？</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <SkillMarketMap nodes={skillNodes} loggedIn={loggedIn} />
          </CardContent>
        </Card>
        <ChartCard icon={<BarChart3 className="size-4 text-indigo-400" />} title="技能热度 TOP" badge={"样本 " + data.bySkill.reduce((a, s) => a + s.count, 0) + " 个"}>
          <CapsuleRank items={data.bySkill.map((s) => ({ label: s.skill, value: s.count }))} />
        </ChartCard>
      </section>

      {/* ===== 03 人才画像 ===== */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">03 · 人才画像</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard icon={<GraduationCap className="size-4 text-violet-400" />} title="学历需求占比" badge={"共 " + data.byEducation.reduce((a, e) => a + e.count, 0) + " 个"}>
            <DonutChart items={data.byEducation.map((e) => ({ label: e.label, value: e.count }))} centerLabel="岗位" />
          </ChartCard>
          <ChartCard icon={<Briefcase className="size-4 text-rose-400" />} title="经验年限要求" badge="应届→资深">
            <CapsuleRank items={data.byExperience.map((e) => ({ label: e.label, value: e.count }))} />
          </ChartCard>
        </div>
      </section>

      {/* ===== 04 我的学习机会 ===== */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">04 · 我的学习机会</h2>
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="flex-row items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><Sparkles className="size-4 text-amber-400" /></span>
            <CardTitle className="text-sm text-foreground">市场洞察</CardTitle>
            <Badge variant="muted" className="ml-auto text-[10px]">真实数据计算</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* 技能 × 薪资象限解读 */}
            {insightData.quadrants.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {insightData.quadrants.map((q) => (
                  <div key={q.key} className="rounded-xl border border-white/10 bg-muted/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: q.color }} />
                      {q.label}
                      <span className="ml-auto text-[10px] font-normal text-muted-foreground">{q.hint}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {q.skills.length ? q.skills.map((s) => (
                        <span key={s} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{s}</span>
                      )) : <span className="text-[10px] text-muted-foreground/60">暂无</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {/* 关键结论 */}
            {insightData.headlines.length ? (
              <div className="flex flex-col gap-1.5">
                {insightData.headlines.map((line) => (
                  <p key={line} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-amber-500" /> {line}
                  </p>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">暂无可计算的洞察，数据积累后将自动生成。</p>}
            {data.generatedAt ? (
              <p className="text-[11px] text-muted-foreground/70">数据更新时间：{new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false })}</p>
            ) : null}
          </CardContent>
        </Card>
        {loggedIn ? (
          <MarketGapsCard limit={6} />
        ) : (
          <Card className="rounded-2xl">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LogIn className="size-4 text-primary" /> 登录后查看你的能力缺口，并一键加入学习路线。
              </div>
              <Button asChild size="sm" variant="secondary"><Link href="/login">去登录</Link></Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ===== 数据说明（来源/类型降权） ===== */}
      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center gap-2">
          <Flower2 className="size-4 text-emerald-400" />
          <CardTitle className="text-sm text-foreground">关于数据</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <p>· 样本来源：招花职位库活跃招聘岗位（不含公告/考试事件），数据随抓取自动更新，缓存 60s；职能方向按职位标题关键词归类，已清洗公司名脏数据。</p>
          <p>· 平台分布：{data.byPlatform.map((p) => `${p.label} ${p.count}`).join(" · ") || "—"}；岗位类型：{data.byJobType.map((t) => `${t.label} ${t.count}`).join(" · ") || "—"}。</p>
          <p>· 薪资按 salary_max 分桶近似；技能-薪资相关性来自技能画像表（job_skill_links）JOIN 平均薪资。</p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">生成于 {data.generatedAt ? new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
