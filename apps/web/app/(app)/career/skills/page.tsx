"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SkillOption, SkillRecommendResult, UserSkillView } from "@learn-workbench/shared/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { cn } from "@/lib/utils";
import { ChevronLeft, GraduationCap, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { MarketGapsCard } from "@/components/skills/market-gaps-card";

const LEVEL_LABELS = ["未掌握", "了解", "入门", "熟练", "精通", "专家"];
const CATEGORY_LABELS: Record<string, string> = {
  backend: "后端", frontend: "前端", data: "数据", ops: "运维/云",
  ai: "AI", network: "网络", security: "安全", cloud: "云计算", soft: "软技能", "": "其他",
};

export default function CareerSkillsPage() {
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [catalog, setCatalog] = useState<SkillOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<SkillOption | null>(null);
  const [newLevel, setNewLevel] = useState(2);
  const [search, setSearch] = useState("");
  const [recommends, setRecommends] = useState<{ id: number; name: string; category: string }[]>([]);
  const [recommendCareer, setRecommendCareer] = useState("");

  const load = useCallback(async () => {
    try {
      const [sR, cR, recR] = await Promise.all([
        fetch("/api/profile/skills"),
        fetch("/api/jobs/skills"),
        fetch("/api/skills/recommend"),
      ]);
      if (!sR.ok) throw new Error("技能加载失败");
      setSkills((await sR.json()).skills ?? []);
      if (cR.ok) setCatalog((await cR.json()).skills ?? []);
      if (recR.ok) {
        const rec = (await recR.json()) as SkillRecommendResult;
        setRecommends(rec.skills ?? []);
        setRecommendCareer(rec.careerName ?? "");
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "技能加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

// eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式，P1 统一迁移）
  useEffect(() => { load(); }, [load]);

  const backfillFromResume = async () => {
    setAdding(true);
    try {
      const r = await fetch("/api/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (!r.ok) throw new Error("回填失败");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "回填失败");
    } finally {
      setAdding(false);
    }
  };

  const addRecommended = async (skillId: number) => {
    try {
      const r = await fetch("/api/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, level: 2 }),
      });
      if (!r.ok) throw new Error("添加失败");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败");
    }
  };

  const addSkill = async () => {
    if (!selected) return;
    try {
      const r = await fetch("/api/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: selected.id, level: newLevel }),
      });
      if (!r.ok) throw new Error("添加失败");
      setSelected(null);
      setNewLevel(2);
      setSearch("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败");
    }
  };

  const updateLevel = async (skillId: number, level: number) => {
    setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, level } : s)));
    await fetch("/api/profile/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId, level }),
    });
  };

  const removeSkill = async (skillId: number) => {
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
    await fetch(`/api/profile/skills?skillId=${skillId}`, { method: "DELETE" });
  };

  const grouped = new Map<string, UserSkillView[]>();
  for (const s of skills) {
    const list = grouped.get(s.category) ?? [];
    list.push(s);
    grouped.set(s.category, list);
  }

  const catalogFiltered = catalog.filter((c) => !skills.some((s) => s.id === c.id));
  const recommendFiltered = recommends.filter((r) => !skills.some((s) => s.id === r.id));

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="技能树"
        description="按分类维护技能等级，岗位匹配与市场能力缺口都按这份画像计算"
        eyebrow={<Badge variant="muted">{skills.length} 项技能</Badge>}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
          </Button>
        }
      />

      {error ? (
        <section className="rounded-3xl border border-danger/30 bg-danger/10 p-4 text-body-medium text-danger">{error}</section>
      ) : null}

      {/* 学习 × 招聘打通：市场高频需求 × 我的能力缺口 */}
      <MarketGapsCard />

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* 技能画像冷启动：按目标职业推荐 */}
        {recommendFiltered.length > 0 ? (
          <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
                  <Sparkles className="size-4 text-accent" />
                </span>
                <h2 className="text-headline-medium text-text-primary">按职业推荐技能</h2>
              </div>
              {recommendCareer ? <Badge variant="muted">{recommendCareer}</Badge> : null}
            </div>
            <div className="flex flex-col gap-2 px-5 pb-5">
              <div className="flex flex-wrap gap-2">
                {recommendFiltered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addRecommended(r.id)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-border-button-default bg-background-primary-default px-3 py-1.5 text-caption-1-medium text-text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    <Plus className="size-3 text-primary" />
                    {r.name}
                    <span className="text-caption-2-medium text-muted-foreground">{CATEGORY_LABELS[r.category] ?? "其他"}</span>
                  </button>
                ))}
              </div>
              <p className="text-caption-1-medium text-muted-foreground">点击即添加为「入门」等级（可随后调整），用于计算岗位匹配度与能力缺口。</p>
            </div>
          </section>
        ) : null}

        {/* 添加技能 */}
        <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
                <GraduationCap className="size-4 text-primary" />
              </span>
              <h2 className="text-headline-medium text-text-primary">技能画像</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={backfillFromResume} disabled={adding}>
              {adding ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              从简历资产回填
            </Button>
          </div>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索技能库添加技能，如 Python / Docker"
                aria-label="搜索技能"
              />
              <select
                value={selected?.id ?? ""}
                onChange={(e) => {
                  const opt = catalogFiltered.find((c) => c.id === Number(e.target.value));
                  setSelected(opt ?? null);
                }}
                aria-label="选择技能"
                className="paper-select h-10 rounded-xl px-3 text-body-medium"
              >
                <option value="">选择技能…</option>
                {catalogFiltered
                  .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.aliases.some((a) => a.toLowerCase().includes(search.toLowerCase())))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{CATEGORY_LABELS[c.category] ?? "其他"} · {c.name}</option>
                  ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={newLevel} onChange={(e) => setNewLevel(Number(e.target.value))} aria-label="等级" className="paper-select h-10 rounded-xl px-3 text-body-medium">
                {LEVEL_LABELS.map((l, i) => <option key={l} value={i}>{i} · {l}</option>)}
              </select>
              <Button size="sm" onClick={addSkill} disabled={!selected}>
                <Plus className="size-4" /> 添加
              </Button>
            </div>
            <p className="text-caption-1-medium text-muted-foreground">技能来源：resume_assets 自动回填（source=resume）或手动维护（source=manual）。岗位匹配度按此画像计算。</p>
          </div>
        </section>
      </div>

      {/* 技能分组展示：2 列卡片网格，长列表卡内滚动 */}
      {loading ? (
        <p className="py-8 text-center text-body-medium text-muted-foreground">加载中…</p>
      ) : skills.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="还没有技能画像"
          hint="从简历资产回填，或手动添加你掌握的技能"
          action={<Button size="sm" onClick={backfillFromResume} disabled={adding}>从简历资产回填</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from(grouped.entries()).map(([cat, list]) => (
            <section key={cat} className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
              <div className="flex items-center gap-2 px-5 pb-2 pt-4">
                <h2 className="text-headline-medium text-text-primary">{CATEGORY_LABELS[cat] ?? "其他"}</h2>
                <Badge variant="muted">{list.length}</Badge>
              </div>
              <div className="px-5 pb-4">
                <ScrollFade className={list.length > 5 ? "h-[300px]" : ""}>
                  <div className="flex flex-col gap-2 pe-1">
                    {list.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2.5">
                        <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{s.name}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          {LEVEL_LABELS.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              aria-label={`设技能 ${s.name} 为 ${LEVEL_LABELS[i]}`}
                              onClick={() => updateLevel(s.id, i)}
                              className={cn(
                                "size-3 rounded-full transition-all",
                                i <= s.level ? "bg-primary" : "bg-background-tertiary-default hover:bg-background-tertiary-hover"
                              )}
                            />
                          ))}
                        </div>
                        <span className="w-12 shrink-0 text-right text-caption-1-medium text-muted-foreground">{LEVEL_LABELS[s.level]}</span>
                        {s.source !== "manual" ? (
                          <Badge variant="muted" className="text-caption-2-medium">{s.source === "resume" ? "简历" : s.source}</Badge>
                        ) : null}
                        <button type="button" onClick={() => removeSkill(s.id)} aria-label={`移除 ${s.name}`} className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollFade>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
