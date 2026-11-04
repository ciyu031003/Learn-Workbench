"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUESTION_STATUS_LABEL, type QuestionStatus } from "@/lib/question-status";
import { ArrowLeft, Loader2, ListChecks, BookOpen, Save, Search } from "lucide-react";

/**
 * 内容管理后台（075 之后内容在数据库里）。
 *
 * 能力：
 *   - 题目：按关键词/状态筛选 → 改题干、选项、答案、解析、标签、难度、分级、题型、状态；
 *   - 知识点：按关键词/课程筛选 → 改标题、摘要、概念/原理/应用/坑、方法、练习、检查点、状态。
 *
 * 保存即写库并清内容缓存，前台（Web/App）下一跳就是新内容，**不需要重新发版**。
 * 鉴权走后端 /api/internal/content/*（需要内容角色会话或 x-cron-secret）。
 */

interface QuestionRow {
  key: string; track_slug: string; stage_key: string; topic_key: string | null;
  type: string; difficulty: string; level: string | null; status: string;
  stem: string; options: { key: string; text: string }[]; answer: string[];
  explanation: string; tags: string[]; source_key: string | null;
}
interface TopicRow {
  track_slug: string; key: string; stage_key: string; title: string; summary: string;
  concepts: string[]; principles: string[]; applications: string[]; pitfalls: string[];
  method: string; exercise: string; checkpoint: string; status: string;
}

const DIFFICULTY_LABEL: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };
const LEVELS = ["", "入门", "进阶", "综合"];
const STATUSES: QuestionStatus[] = ["published", "review", "draft", "archived"];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data?.error ?? "请求失败（" + response.status + "）");
  return data;
}

export default function ContentManagePage() {
  const [tab, setTab] = useState<"questions" | "topics">("questions");
  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="内容管理"
        description="题目与知识点都存在数据库里；这里改完立即生效，前台不需要重新发布。"
        icon={<BookOpen className="size-5 text-primary" />}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings"><ArrowLeft className="size-4" /> 返回设置</Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as "questions" | "topics")}>
        <TabsList>
          <TabsTrigger value="questions">
            <ListChecks className="size-4" /> 题目
          </TabsTrigger>
          <TabsTrigger value="topics">
            <BookOpen className="size-4" /> 知识点
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "questions" ? <QuestionsPanel /> : <TopicsPanel />}
    </div>
  );
}

function QuestionsPanel() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<QuestionRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      const data = await api<{ rows: QuestionRow[]; total: number }>("/api/internal/content/questions?" + params);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  // 首屏加载 / 筛选条件变化后重新拉取。
  // 延迟到下一个宏任务再触发：load 内部会同步 setLoading(true)，
  // 直接在 effect 里同步调用会让 react-hooks/set-state-in-effect 报错，
  // 行为与原来一致（请求仍在挂载后立刻发出）。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className={active ? "grid gap-4 xl:grid-cols-2 xl:items-start" : "flex flex-col gap-4"}>
      <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-5">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题干" className="pl-9" aria-label="搜索题干" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="按状态筛选" className="paper-select h-9 rounded-lg px-2 text-body-medium">
            <option value="">全部状态</option>
            {STATUSES.map((item) => <option key={item} value={item}>{QUESTION_STATUS_LABEL[item]}</option>)}
          </select>
          <span className="text-caption-1-medium text-muted-foreground">{loading ? "加载中…" : "共 " + total + " 道"}</span>
        </div>

        <div className="px-5 pb-5">
          {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-body-medium text-danger">{error}</p> : null}

          {rows.length === 0 && !loading ? (
            <EmptyState icon={ListChecks} title="没有匹配的题目" hint="换个关键词，或先跑一次内容同步。" />
          ) : (
            <ScrollFade className="h-[340px]">
              <div className="grid gap-2 pe-1 md:grid-cols-2">
                {rows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setActive(row)}
                    className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border-button-default bg-background-primary-default p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex flex-wrap items-center gap-1.5 text-caption-1-medium text-muted-foreground">
                      <Badge variant="outline">{row.track_slug}</Badge>
                      <span>{row.type === "judge" ? "判断" : "单选"}</span>
                      <span>·</span>
                      <span>{row.level ?? "未分级"}</span>
                      <span>·</span>
                      <span>{DIFFICULTY_LABEL[row.difficulty] ?? row.difficulty}</span>
                      <span>·</span>
                      <span>{QUESTION_STATUS_LABEL[row.status as QuestionStatus] ?? row.status}</span>
                    </span>
                    <span className="line-clamp-2 text-body-medium text-text-primary">{row.stem}</span>
                  </button>
                ))}
              </div>
            </ScrollFade>
          )}
        </div>
      </section>

      {active ? <QuestionEditor row={active} onClose={() => setActive(null)} onSaved={() => { setActive(null); void load(); }} /> : null}
    </div>
  );
}

function QuestionEditor({ row, onClose, onSaved }: { row: QuestionRow; onClose: () => void; onSaved: () => void }) {
  const [stem, setStem] = useState(row.stem);
  const [explanation, setExplanation] = useState(row.explanation);
  const [options, setOptions] = useState(row.options.map((option) => ({ ...option })));
  const [answer, setAnswer] = useState(row.answer[0] ?? "");
  const [tags, setTags] = useState(row.tags.join("、"));
  const [difficulty, setDifficulty] = useState(row.difficulty);
  const [level, setLevel] = useState(row.level ?? "");
  const [status, setStatus] = useState(row.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api("/api/internal/content/questions", {
        method: "PATCH",
        body: JSON.stringify({
          key: row.key,
          patch: {
            stem,
            explanation,
            options: options.map((option) => ({ key: option.key.trim(), text: option.text.trim() })),
            answer: [answer],
            tags: tags.split(/[、,，\s]+/).filter(Boolean),
            difficulty,
            level: level || null,
            status,
          },
        }),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex min-w-0 flex-col rounded-3xl border border-primary/30 bg-background-secondary-default">
      <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
        <p className="text-headline-medium text-text-primary">
          编辑题目 <span className="font-mono text-caption-1-medium text-muted-foreground">{row.key}</span>
        </p>
        <button type="button" onClick={onClose} className="text-caption-1-medium text-muted-foreground hover:text-text-primary">关闭</button>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5">
        {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-body-medium text-danger">{error}</p> : null}

        <Field label="题干">
          <Textarea className="min-h-20" value={stem} onChange={(event) => setStem(event.target.value)} />
        </Field>
        <Field label="选项（左侧为 key）">
          <div className="flex flex-col gap-1.5">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="h-8 w-12 px-2 text-center text-body-medium"
                  value={option.key}
                  onChange={(event) => setOptions(options.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)))}
                  aria-label={"选项 " + (index + 1) + " key"}
                />
                <Input
                  className="h-8 flex-1 text-body-medium"
                  value={option.text}
                  onChange={(event) => setOptions(options.map((item, i) => (i === index ? { ...item, text: event.target.value } : item)))}
                  aria-label={"选项 " + (index + 1) + " 内容"}
                />
              </div>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="正确答案">
            <select value={answer} onChange={(event) => setAnswer(event.target.value)} className="paper-select h-9 rounded-lg px-2 text-body-medium" aria-label="正确答案">
              {options.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}
            </select>
          </Field>
          <Field label="难度">
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="paper-select h-9 rounded-lg px-2 text-body-medium" aria-label="难度">
              {["easy", "medium", "hard"].map((item) => <option key={item} value={item}>{DIFFICULTY_LABEL[item]}</option>)}
            </select>
          </Field>
          <Field label="分级">
            <select value={level} onChange={(event) => setLevel(event.target.value)} className="paper-select h-9 rounded-lg px-2 text-body-medium" aria-label="分级">
              {LEVELS.map((item) => <option key={item} value={item}>{item || "未分级"}</option>)}
            </select>
          </Field>
          <Field label="状态">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="paper-select h-9 rounded-lg px-2 text-body-medium" aria-label="状态">
              {STATUSES.map((item) => <option key={item} value={item}>{QUESTION_STATUS_LABEL[item]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="解析">
          <Textarea className="min-h-24" value={explanation} onChange={(event) => setExplanation(event.target.value)} />
        </Field>
        <Field label="标签（顿号或逗号分隔）">
          <Input value={tags} onChange={(event) => setTags(event.target.value)} />
        </Field>
        <Button onClick={() => void save()} disabled={saving} className="w-fit gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          保存
        </Button>
      </div>
    </section>
  );
}

function TopicsPanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<TopicRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<TopicRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (query.trim()) params.set("q", query.trim());
      const data = await api<{ rows: TopicRow[]; total: number }>("/api/internal/content/topics?" + params);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // 首屏加载 / 筛选条件变化后重新拉取。
  // 延迟到下一个宏任务再触发：load 内部会同步 setLoading(true)，
  // 直接在 effect 里同步调用会让 react-hooks/set-state-in-effect 报错，
  // 行为与原来一致（请求仍在挂载后立刻发出）。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className={active ? "grid gap-4 xl:grid-cols-2 xl:items-start" : "flex flex-col gap-4"}>
      <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-5">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识点标题/摘要" className="pl-9" aria-label="搜索知识点" />
          </div>
          <span className="text-caption-1-medium text-muted-foreground">{loading ? "加载中…" : "共 " + total + " 个（仅显示前 " + rows.length + "）"}</span>
        </div>
        <div className="px-5 pb-5">
          {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-body-medium text-danger">{error}</p> : null}
          {rows.length === 0 && !loading ? (
            <EmptyState icon={BookOpen} title="没有匹配的知识点" hint="换个关键词，或先跑一次内容同步。" />
          ) : (
            <ScrollFade className="h-[340px]">
              <div className="grid gap-2 pe-1 md:grid-cols-2">
                {rows.map((row) => (
                  <button
                    key={row.track_slug + "/" + row.key}
                    type="button"
                    onClick={() => setActive(row)}
                    className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border-button-default bg-background-primary-default p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex flex-wrap items-center gap-1.5 text-caption-1-medium text-muted-foreground">
                      <Badge variant="outline">{row.track_slug}</Badge>
                      <span>{row.stage_key}</span>
                      <span>·</span>
                      <span>{row.status}</span>
                    </span>
                    <span className="text-body-medium text-text-primary">{row.title}</span>
                    <span className="line-clamp-2 text-caption-1-medium text-muted-foreground">{row.summary}</span>
                  </button>
                ))}
              </div>
            </ScrollFade>
          )}
        </div>
      </section>

      {active ? <TopicEditor row={active} onClose={() => setActive(null)} onSaved={() => { setActive(null); void load(); }} /> : null}
    </div>
  );
}

function TopicEditor({ row, onClose, onSaved }: { row: TopicRow; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(row.title);
  const [summary, setSummary] = useState(row.summary);
  const [method, setMethod] = useState(row.method);
  const [exercise, setExercise] = useState(row.exercise);
  const [checkpoint, setCheckpoint] = useState(row.checkpoint);
  const [concepts, setConcepts] = useState(row.concepts.join("\n"));
  const [principles, setPrinciples] = useState(row.principles.join("\n"));
  const [applications, setApplications] = useState(row.applications.join("\n"));
  const [pitfalls, setPitfalls] = useState(row.pitfalls.join("\n"));
  const [status, setStatus] = useState(row.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lines = useMemo(() => (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean), []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api("/api/internal/content/topics", {
        method: "PATCH",
        body: JSON.stringify({
          trackSlug: row.track_slug,
          key: row.key,
          patch: {
            title, summary, method, exercise, checkpoint,
            concepts: lines(concepts), principles: lines(principles),
            applications: lines(applications), pitfalls: lines(pitfalls),
            status,
          },
        }),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex min-w-0 flex-col rounded-3xl border border-primary/30 bg-background-secondary-default">
      <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
        <p className="text-headline-medium text-text-primary">
          编辑知识点 <span className="font-mono text-caption-1-medium text-muted-foreground">{row.track_slug}/{row.key}</span>
        </p>
        <button type="button" onClick={onClose} className="text-caption-1-medium text-muted-foreground hover:text-text-primary">关闭</button>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5">
        {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-body-medium text-danger">{error}</p> : null}
        <Field label="标题"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field label="摘要"><Textarea className="min-h-16" value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="概念（一行一条）"><Textarea className="min-h-24" value={concepts} onChange={(event) => setConcepts(event.target.value)} /></Field>
          <Field label="原理（一行一条）"><Textarea className="min-h-24" value={principles} onChange={(event) => setPrinciples(event.target.value)} /></Field>
          <Field label="应用（一行一条）"><Textarea className="min-h-24" value={applications} onChange={(event) => setApplications(event.target.value)} /></Field>
          <Field label="常见坑（一行一条）"><Textarea className="min-h-24" value={pitfalls} onChange={(event) => setPitfalls(event.target.value)} /></Field>
        </div>
        <Field label="学习方法"><Textarea className="min-h-16" value={method} onChange={(event) => setMethod(event.target.value)} /></Field>
        <Field label="练习"><Textarea className="min-h-16" value={exercise} onChange={(event) => setExercise(event.target.value)} /></Field>
        <Field label="检查点"><Textarea className="min-h-16" value={checkpoint} onChange={(event) => setCheckpoint(event.target.value)} /></Field>
        <Field label="状态">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="paper-select h-9 rounded-lg px-2 text-body-medium" aria-label="知识点状态">
            {STATUSES.map((item) => <option key={item} value={item}>{QUESTION_STATUS_LABEL[item]}</option>)}
          </select>
        </Field>
        <Button onClick={() => void save()} disabled={saving} className="w-fit gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          保存
        </Button>
      </div>
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className ? `flex flex-col gap-1 ${className}` : "flex flex-col gap-1"}>
      <span className="text-caption-1-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}