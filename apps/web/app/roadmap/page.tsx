"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from "react";
import type { RoadmapPhase } from "@learn-workbench/shared";
import { pct } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { GlassModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  BookOpen,
  Wrench,
  FolderGit2,
  Target,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
} from "lucide-react";

interface RoadmapResponse {
  phases: RoadmapPhase[];
}

type Track = "main" | "agent";

const phaseLabel = (key: string) => key.replace("phase-", "P");

export default function RoadmapPage() {
  const [phases, setPhases] = useState<RoadmapPhase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [detail, setDetail] = useState<Record<number, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [formPhase, setFormPhase] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [careers, setCareers] = useState<{ career_key: string; name: string; description: string | null; is_locked: boolean }[]>([]);
  const [career, setCareer] = useState<string>("ict");
  // 大阶段自定义：拖拽排序 + 增删/编辑
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [phaseModal, setPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<RoadmapPhase | null>(null);
  const [phaseForm, setPhaseForm] = useState({ track: "main" as Track, title: "", summary: "", weeks: "" });

  const load = useCallback(async (careerKey: string) => {
    try {
      const r = await fetch(`/api/roadmap?career=${careerKey}`);
      if (!r.ok) throw new Error("load failed");
      const data = (await r.json()) as RoadmapResponse;
      setPhases(data.phases);
      setExpanded((prev) => {
        const next = { ...prev };
        data.phases.forEach((p, i) => {
          if (i < 2 && next[p.id] === undefined) next[p.id] = true;
        });
        return next;
      });
    } catch {
      setError("数据库暂不可用，请确认已运行 scripts\\start_pg.ps1");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cRes, curRes] = await Promise.all([
          fetch("/api/careers"),
          fetch("/api/settings/career"),
        ]);
        const cData = await cRes.json();
        const curData = await curRes.json();
        if (!alive) return;
        setCareers(cData.careers ?? []);
        setCareer(curData.career ?? "ict");
      } catch {
        // 职业接口不可用时保持默认 ICT
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(career);
  }, [career, load]);

  // 从技能缺口等入口带 #phase-<id> 进入：展开并滚动定位到对应阶段
  useEffect(() => {
    if (!phases) return;
    const m = window.location.hash.match(/^#phase-(\d+)$/);
    if (!m) return;
    const target = Number(m[1]);
    if (!phases.some((p) => p.id === target)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 进入路线图时按 hash 展开目标阶段（既有模式）
    setExpanded((prev) => (prev[target] ? prev : { ...prev, [target]: true }));
    const t = window.setTimeout(() => {
      document.getElementById(`phase-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [phases]);
  const switchCareer = async (key: string) => {
    setCareer(key);
    try {
      await fetch("/api/settings/career", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career: key }),
      });
    } catch {
      // 忽略保存失败
    }
  };

  const currentCareer = careers.find((c) => c.career_key === career);
  const canEdit = !!currentCareer && !currentCareer.is_locked;

  const toggleTopic = async (topicId: number, done: boolean) => {
    setPhases((prev) =>
      prev?.map((p) => ({
        ...p,
        topics: p.topics.map((t) => (t.id === topicId ? { ...t, done, note: t.note } : t)),
      })) ?? prev
    );
    await fetch("/api/progress", {
      method: "POST",
      body: JSON.stringify({ topicId, done }),
    });
  };

  const togglePhase = (id: number) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const addCustom = async () => {
    const phaseId = Number(formPhase);
    if (!Number.isFinite(phaseId) || !formTitle.trim()) return;
    const r = await fetch("/api/roadmap/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, title: formTitle.trim(), summary: formSummary.trim() || null }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      setError(data?.error ?? "添加失败");
      return;
    }
    setFormPhase("");
    setFormTitle("");
    setFormSummary("");
    setAdding(false);
    load(career);
  };

  const deleteCustom = async (topicId: number) => {
    await fetch(`/api/roadmap/custom?topicId=${topicId}`, { method: "DELETE" });
    load(career);
  };
  const toggleDetail = (id: number) => setDetail((s) => ({ ...s, [id]: !s[id] }));

  // ---------- 大阶段：拖拽排序 ----------
  const onPhaseDragStart = (e: ReactDragEvent, phase: RoadmapPhase) => {
    if (!canEdit) return;
    setDragId(phase.id);
    e.dataTransfer.setData("text/plain", String(phase.id));
    e.dataTransfer.effectAllowed = "move";
  };

  const onPhaseDragOver = (e: ReactDragEvent, phase: RoadmapPhase) => {
    if (dragId == null || dragId === phase.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== phase.id) setDragOverId(phase.id);
  };

  const saveOrder = async (track: Track, order: number[]) => {
    try {
      const r = await fetch("/api/roadmap/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career, track, order }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setError(d?.error ?? "排序保存失败");
      }
    } catch {
      setError("排序保存失败");
    }
    load(career); // 重新拉取，同步自动更名后的 P 编号
  };

  const onPhaseDrop = (e: ReactDragEvent, track: Track) => {
    e.preventDefault();
    const fromId = dragId;
    const toId = dragOverId;
    setDragId(null);
    setDragOverId(null);
    if (fromId == null || toId == null || fromId === toId) return;
    const list = phases?.filter((p) => p.track === track) ?? [];
    const fromIdx = list.findIndex((p) => p.id === fromId);
    const toIdx = list.findIndex((p) => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const order = next.map((p) => p.id);
    // 乐观更新：先本地换位，后台保存成功后重新拉取
    setPhases((prev) => {
      if (!prev) return prev;
      const nextMap = new Map(next.map((p, i) => [p.id, { ...p, sortOrder: i }]));
      return prev.map((p) => (p.track === track && nextMap.has(p.id) ? (nextMap.get(p.id) as RoadmapPhase) : p));
    });
    void saveOrder(track, order);
  };

  const onPhaseDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  // ---------- 大阶段：新增 / 编辑 / 删除 ----------
  const openAddPhase = () => {
    setEditingPhase(null);
    setPhaseForm({ track: "main", title: "", summary: "", weeks: "" });
    setPhaseModal(true);
  };

  const openEditPhase = (phase: RoadmapPhase) => {
    setEditingPhase(phase);
    setPhaseForm({
      track: phase.track,
      title: phase.title,
      summary: phase.summary ?? "",
      weeks: phase.weeks ?? "",
    });
    setPhaseModal(true);
  };

  const savePhase = async () => {
    if (!phaseForm.title.trim()) return;
    const payload = {
      career,
      track: phaseForm.track,
      title: phaseForm.title.trim(),
      summary: phaseForm.summary.trim() || null,
      weeks: phaseForm.weeks.trim() || null,
    };
    const r = editingPhase
      ? await fetch("/api/roadmap/phases", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingPhase.id }),
        })
      : await fetch("/api/roadmap/phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setError(d?.error ?? "保存失败");
      return;
    }
    setPhaseModal(false);
    load(career);
  };

  const deletePhase = async (phase: RoadmapPhase) => {
    if (!window.confirm(`确定删除大阶段「${phase.title}」？其下所有主题/内容将一并删除，此操作不可恢复。`)) return;
    const r = await fetch(`/api/roadmap/phases?id=${phase.id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setError(d?.error ?? "删除失败");
      return;
    }
    load(career);
  };

  const main = useMemo(() => phases?.filter((p) => p.track === "main") ?? [], [phases]);
  const agent = useMemo(() => phases?.filter((p) => p.track === "agent") ?? [], [phases]);

  const overall = useMemo(() => {
    if (!phases) return 0;
    const all = phases.flatMap((p) => p.topics);
    return pct(all.filter((t) => t.done).length, all.length);
  }, [phases]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
      </Card>
    );
  }
  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">学习路线图</h1>
          <p className="page-subtitle mt-1 text-sm">
            {currentCareer ? currentCareer.name : "ICT 学习规划"} · 主题完成即打勾，进度自动聚合
            {canEdit
              ? "（可自定义：拖动排序、增删/编辑阶段、添加主题）"
              : "（系统固定内容，不可修改）"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">职业 / 学习路线</label>
          <select
            value={career}
            onChange={(e) => switchCareer(e.target.value)}
            className="glass-select h-10 min-w-44 rounded-xl px-3 text-sm outline-none backdrop-blur-md"
          >
            {careers.map((c) => (
              <option key={c.career_key} value={c.career_key}>
                {c.name}{c.is_locked ? "（固定）" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!phases ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="text-2xl font-semibold">{overall}%</span>
              <Progress value={overall} className="flex-1" />
              <span className="text-sm text-muted-foreground">
                {phases.flatMap((p) => p.topics).filter((t) => t.done).length}/
                {phases.flatMap((p) => p.topics).length} 主题
              </span>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={openAddPhase}>
                    <Plus className="size-4" /> 添加大阶段
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                    <Plus className="size-4" /> 自定义主题
                  </Button>
                </div>
              ) : (
                <Badge variant="muted">ICT 规划固定 · 不可自定义</Badge>
              )}
            </CardContent>
          </Card>

          <GlassModal open={adding} onClose={() => setAdding(false)} title="添加自定义学习内容">
            <p className="mb-3 text-xs text-muted-foreground">选择要在哪个 P 阶段下添加学习主题</p>
            <div className="flex flex-col gap-3">
              <select
                value={formPhase}
                onChange={(e) => setFormPhase(e.target.value)}
                className="glass-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
              >
                <option value="">选择阶段…</option>
                {main.concat(agent).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.track === "main" ? phaseLabel(p.phaseKey) : "Agent"} · {p.title}
                  </option>
                ))}
              </select>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="学习内容标题（必填）"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
              <input
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="简要说明（可选）"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>取消</Button>
              <Button onClick={addCustom} disabled={!formPhase || !formTitle.trim()}>
                <Plus className="size-4" /> 添加
              </Button>
            </div>
          </GlassModal>

          {/* 新增/编辑大阶段 */}
          <GlassModal
            open={phaseModal}
            onClose={() => setPhaseModal(false)}
            title={editingPhase ? "编辑大阶段" : "添加大阶段"}
          >
            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted-foreground">所属轨道</label>
              <select
                value={phaseForm.track}
                onChange={(e) => setPhaseForm((s) => ({ ...s, track: e.target.value as Track }))}
                className="glass-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
              >
                <option value="main">主线（P1/P2/…，自动编号）</option>
                <option value="agent">Agent 副线</option>
              </select>
              <input
                value={phaseForm.title}
                onChange={(e) => setPhaseForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="阶段名称（必填），如：数据库进阶实战"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
              <input
                value={phaseForm.summary}
                onChange={(e) => setPhaseForm((s) => ({ ...s, summary: e.target.value }))}
                placeholder="阶段简介（可选）"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
              <input
                value={phaseForm.weeks}
                onChange={(e) => setPhaseForm((s) => ({ ...s, weeks: e.target.value }))}
                placeholder="周期（可选），如：第 37-40 周"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPhaseModal(false)}>取消</Button>
              <Button onClick={savePhase} disabled={!phaseForm.title.trim()}>
                <Plus className="size-4" /> {editingPhase ? "保存" : "添加"}
              </Button>
            </div>
          </GlassModal>
          {/* 主轨阶段 */}
          {main.map((phase) => {
            const doneCount = phase.topics.filter((t) => t.done).length;
            const percent = pct(doneCount, phase.topics.length);
            const isOpen = !!expanded[phase.id];
            return (
              <Card
                key={phase.id}
                id={`phase-${phase.id}`}
                draggable={canEdit}
                onDragStart={(e) => onPhaseDragStart(e, phase)}
                onDragOver={(e) => onPhaseDragOver(e, phase)}
                onDrop={(e) => onPhaseDrop(e, "main")}
                onDragEnd={onPhaseDragEnd}
                className={`roadmap-phase-card ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === phase.id ? "opacity-50" : ""} ${dragOverId === phase.id && dragId !== phase.id ? "ring-2 ring-primary/60" : ""}`}
              >
                <div className="flex items-center">
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 p-5 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                      {phaseLabel(phase.phaseKey)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{phase.title}</span>
                        {phase.weeks ? <Badge variant="muted">{phase.weeks}</Badge> : null}
                        {phase.isCustom ? <Badge variant="accent">自定义</Badge> : null}
                      </span>
                      {phase.summary ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={phase.summary ?? undefined}>{phase.summary}</span>
                      ) : null}
                    </span>
                    <span className="hidden w-28 shrink-0 sm:block">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{doneCount}/{phase.topics.length}</span>
                        <span>{percent}%</span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </span>
                    {isOpen ? <ChevronDown className="size-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
                  </button>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-0.5 pr-3">
                      <span title="拖拽排序" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60">
                        <GripVertical className="size-4" />
                      </span>
                      <button onClick={() => openEditPhase(phase)} aria-label="编辑阶段" title="编辑阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => deletePhase(phase)} aria-label="删除阶段" title="删除阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {isOpen ? (
                  <div className="border-t border-border/60 px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {phase.topics.map((topic) => {
                        const isDetail = !!detail[topic.id];
                        return (
                          <div
                            key={topic.id}
                            className={`rounded-xl border ${topic.done ? "border-success/20 bg-success/5" : "border-border/60 bg-muted/30"}`}
                          >
                            <div className="flex items-center gap-3 px-3 py-2.5">
                              <button
                                onClick={() => toggleTopic(topic.id, !topic.done)}
                                aria-label={topic.done ? "标记为未完成" : "标记为完成"}
                                className="shrink-0 rounded-lg p-2 -m-2"
                              >
                                {topic.done ? (
                                  <CheckCircle2 className="size-5 text-success" />
                                ) : (
                                  <Circle className="size-5 text-muted-foreground/50 hover:text-primary" />
                                )}
                              </button>
                              <button
                                onClick={() => toggleDetail(topic.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className={`text-sm font-medium ${topic.done ? "text-muted-foreground line-through" : ""}`}>
                                  {topic.title}
                                </span>
                                {topic.agentTask ? (
                                  <span className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                                    <Sparkles className="size-3.5" /> {topic.agentTask}
                                  </span>
                                ) : null}
                              </button>
                              {topic.isCustom ? (
                                <Badge variant="accent">自定义</Badge>
                              ) : null}
                              {topic.isCustom ? (
                                <button
                                  onClick={() => deleteCustom(topic.id)}
                                  aria-label="删除自定义主题"
                                  className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-danger/15 hover:text-danger"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              ) : null}
                              {isDetail ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                            </div>

                            {isDetail ? (
                              <div className="space-y-3 border-t border-border/40 px-3 py-3 text-sm">
                                {topic.summary ? <p className="text-muted-foreground">{topic.summary}</p> : null}

                                {topic.resources.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <BookOpen className="size-3.5" /> 资源
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {topic.resources.map((r) => (
                                        <Badge key={r.id} variant="outline">
                                          {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-primary">{r.name}</a> : r.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {topic.practices.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <Wrench className="size-3.5" /> 实操
                                    </p>
                                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                                      {topic.practices.map((p) => (
                                        <li key={p.id}>{p.text}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {topic.projects.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <FolderGit2 className="size-3.5" /> 项目 / 产出
                                    </p>
                                    <ul className="space-y-1.5">
                                      {topic.projects.map((p) => (
                                        <li key={p.id} className="rounded-lg bg-card px-3 py-2 shadow-sm">
                                          <span className="font-medium">{p.name}</span>
                                          {p.description ? <span className="ml-2 text-xs text-muted-foreground">{p.description}</span> : null}
                                          {p.deliverable ? (
                                            <span className="mt-0.5 block text-xs text-muted-foreground">产出：{p.deliverable}</span>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {topic.checkpoints.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <Target className="size-3.5" /> 验收标准
                                    </p>
                                    <ul className="space-y-1">
                                      {topic.checkpoints.map((c) => (
                                        <li key={c.id} className="flex items-start gap-1.5 text-muted-foreground">
                                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary/60" />
                                          {c.text}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
          {/* Agent 副线 */}
          {agent.map((phase) => {
            const doneCount = phase.topics.filter((t) => t.done).length;
            const percent = pct(doneCount, phase.topics.length);
            const isOpen = !!expanded[phase.id];
            return (
              <Card
                key={phase.id}
                draggable={canEdit}
                onDragStart={(e) => onPhaseDragStart(e, phase)}
                onDragOver={(e) => onPhaseDragOver(e, phase)}
                onDrop={(e) => onPhaseDrop(e, "agent")}
                onDragEnd={onPhaseDragEnd}
                className={`roadmap-phase-card border-accent/20 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === phase.id ? "opacity-50" : ""} ${dragOverId === phase.id && dragId !== phase.id ? "ring-2 ring-accent/60" : ""}`}
              >
                <div className="flex items-center">
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 p-5 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Sparkles className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{phase.title}</span>
                        <Badge variant="accent">{phase.weeks}</Badge>
                        {phase.isCustom ? <Badge variant="accent">自定义</Badge> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={phase.summary ?? undefined}>{phase.summary}</span>
                    </span>
                    <span className="hidden w-28 shrink-0 sm:block">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{doneCount}/{phase.topics.length}</span>
                        <span>{percent}%</span>
                      </div>
                      <Progress value={percent} indicatorClassName="progress-fill-accent" className="h-1.5" />
                    </span>
                    {isOpen ? <ChevronDown className="size-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
                  </button>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-0.5 pr-3">
                      <span title="拖拽排序" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60">
                        <GripVertical className="size-4" />
                      </span>
                      <button onClick={() => openEditPhase(phase)} aria-label="编辑阶段" title="编辑阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => deletePhase(phase)} aria-label="删除阶段" title="删除阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="border-t border-border/60 px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {phase.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${topic.done ? "border-success/20 bg-success/5" : "border-border/60 bg-muted/30"}`}
                        >
                          <button onClick={() => toggleTopic(topic.id, !topic.done)} aria-label={topic.done ? "标记为未完成" : "标记为完成"} className="shrink-0 rounded-lg p-2 -m-2">
                            {topic.done ? (
                              <CheckCircle2 className="size-5 text-success" />
                            ) : (
                              <Circle className="size-5 text-muted-foreground/50 hover:text-primary" />
                            )}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${topic.done ? "text-muted-foreground line-through" : ""}`}>
                            {topic.title}
                          </span>
                          <span className="hidden text-xs text-muted-foreground sm:block">{topic.summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}