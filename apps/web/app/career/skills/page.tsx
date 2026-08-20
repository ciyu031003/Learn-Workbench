"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SkillOption, UserSkillView } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ChevronLeft, GraduationCap, Plus, RefreshCw, Trash2, X } from "lucide-react";

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

  const load = useCallback(async () => {
    try {
      const [sR, cR] = await Promise.all([
        fetch("/api/profile/skills"),
        fetch("/api/jobs/skills"),
      ]);
      if (!sR.ok) throw new Error("技能加载失败");
      setSkills((await sR.json()).skills ?? []);
      if (cR.ok) setCatalog((await cR.json()).skills ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "技能加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
        </Button>
        <h1 className="page-title text-2xl font-bold tracking-tight">技能树</h1>
        <Badge variant="muted">{skills.length} 项技能</Badge>
      </div>

      {error ? (
        <Card><CardContent className="p-4 text-sm text-danger">{error}</CardContent></Card>
      ) : null}

      {/* 添加技能 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><GraduationCap className="size-5 text-primary" /> 技能画像</CardTitle>
          <Button variant="secondary" size="sm" onClick={backfillFromResume} disabled={adding}>
            {adding ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            从简历资产回填
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索技能库添加技能，如 Python / Docker"
              className="h-10 w-full max-w-xs rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
            />
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const opt = catalogFiltered.find((c) => c.id === Number(e.target.value));
                setSelected(opt ?? null);
              }}
              className="glass-select h-10 rounded-xl px-3 text-sm"
            >
              <option value="">选择技能…</option>
              {catalogFiltered
                .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.aliases.some((a) => a.toLowerCase().includes(search.toLowerCase())))
                .map((c) => (
                  <option key={c.id} value={c.id}>{CATEGORY_LABELS[c.category] ?? "其他"} · {c.name}</option>
                ))}
            </select>
            <select value={newLevel} onChange={(e) => setNewLevel(Number(e.target.value))} className="glass-select h-10 rounded-xl px-3 text-sm">
              {LEVEL_LABELS.map((l, i) => <option key={l} value={i}>{i} · {l}</option>)}
            </select>
            <Button size="sm" onClick={addSkill} disabled={!selected}>
              <Plus className="size-4" /> 添加
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">技能来源：resume_assets 自动回填（source=resume）或手动维护（source=manual）。岗位匹配度按此画像计算。</p>
        </CardContent>
      </Card>

      {/* 技能分组展示 */}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
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
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="text-sm">{CATEGORY_LABELS[cat] ?? "其他"} · {list.length}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {list.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/15 bg-muted/30 px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                    <div className="flex items-center gap-1">
                      {LEVEL_LABELS.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`设技能 ${s.name} 为 ${LEVEL_LABELS[i]}`}
                          onClick={() => updateLevel(s.id, i)}
                          className={cn(
                            "size-3 rounded-full transition-all",
                            i <= s.level ? "bg-gradient-to-br from-emerald-400 to-cyan-500" : "bg-white/15 hover:bg-white/25"
                          )}
                        />
                      ))}
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">{LEVEL_LABELS[s.level]}</span>
                    {s.source !== "manual" ? (
                      <Badge variant="muted" className="text-[10px]">{s.source === "resume" ? "简历" : s.source}</Badge>
                    ) : null}
                    <button type="button" onClick={() => removeSkill(s.id)} aria-label={`移除 ${s.name}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
