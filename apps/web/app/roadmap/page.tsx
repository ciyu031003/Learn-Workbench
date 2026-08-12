"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RoadmapPhase } from "@learn-workbench/shared";
import { pct } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
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
  X,
} from "lucide-react";

interface RoadmapResponse {
  phases: RoadmapPhase[];
}

export default function RoadmapPage() {
  const [phases, setPhases] = useState<RoadmapPhase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [detail, setDetail] = useState<Record<number, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [formPhase, setFormPhase] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/roadmap");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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
    await fetch("/api/roadmap/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, title: formTitle.trim(), summary: formSummary.trim() || null }),
    });
    setFormPhase("");
    setFormTitle("");
    setFormSummary("");
    setAdding(false);
    load();
  };

  const deleteCustom = async (topicId: number) => {
    await fetch(`/api/roadmap/custom?topicId=${topicId}`, { method: "DELETE" });
    load();
  };
  const toggleDetail = (id: number) => setDetail((s) => ({ ...s, [id]: !s[id] }));

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
      <div>
        <h1 className="page-title text-2xl font-semibold tracking-tight lg:text-3xl">学习路线图</h1>
        <p className="page-subtitle mt-1 text-sm">
          6 个主阶段 + Agent 应用副线 · 主题完成即打勾，进度自动聚合
        </p>
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
              <Button variant="secondary" size="sm" onClick={() => setAdding((v) => !v)}>
                {adding ? <X className="size-4" /> : <Plus className="size-4" />}
                {adding ? "取消" : "自定义主题"}
              </Button>
            </CardContent>
          </Card>

          {adding ? (
            <Card className="border-primary/30">
              <CardContent className="flex flex-col gap-3 p-5">
                <p className="text-sm font-medium">添加自定义学习内容</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={formPhase}
                    onChange={(e) => setFormPhase(e.target.value)}
                    className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md focus:border-primary/60"
                  >
                    <option value="">选择阶段…</option>
                    {main.concat(agent).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
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
                <Button onClick={addCustom} disabled={!formPhase || !formTitle.trim()} className="self-end">
                  <Plus className="size-4" /> 添加
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* 主轨阶段 */}
          {main.map((phase) => {
            const doneCount = phase.topics.filter((t) => t.done).length;
            const percent = pct(doneCount, phase.topics.length);
            const isOpen = !!expanded[phase.id];
            return (
              <Card key={phase.id}>
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="flex w-full items-center gap-3 p-5 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {phase.phaseKey.replace("phase-", "P")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{phase.title}</span>
                      {phase.weeks ? <Badge variant="muted">{phase.weeks}</Badge> : null}
                    </span>
                    {phase.summary ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{phase.summary}</span>
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
                                className="shrink-0"
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
              <Card key={phase.id} className="border-accent/20">
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="flex w-full items-center gap-3 p-5 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Sparkles className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{phase.title}</span>
                      <Badge variant="accent">{phase.weeks}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{phase.summary}</span>
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
                {isOpen ? (
                  <div className="border-t border-border/60 px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {phase.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${topic.done ? "border-success/20 bg-success/5" : "border-border/60 bg-muted/30"}`}
                        >
                          <button onClick={() => toggleTopic(topic.id, !topic.done)} aria-label="切换完成" className="shrink-0">
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





