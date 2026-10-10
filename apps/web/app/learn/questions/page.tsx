"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LEARNING_DIFFICULTY_LABEL } from "@/lib/learning-stats";
import { QUESTION_STATUS_LABEL, isQuestionStatus, type QuestionStatus } from "@/lib/question-status";
import {
  filterLearningQuestions,
  flattenLearningQuestions,
  learningQuestionFacets,
  type LearningQuestionFilters,
  type LearningQuestionItem,
} from "@/lib/learning-questions";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, ListChecks, Search } from "lucide-react";

const ALL = "__all__";
const ALL_QUESTIONS = flattenLearningQuestions();

export default function LearnQuestionsPage() {
  return (
    <Suspense fallback={null}>
      <QuestionsBrowser />
    </Suspense>
  );
}

function QuestionsBrowser() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<LearningQuestionFilters>(() => ({
    track: params.get("track"),
    topic: params.get("topic"),
    stage: params.get("stage"),
    type: null,
    difficulty: null,
    tag: null,
    source: null,
    keyword: params.get("q") ?? "",
  }));

  // 题目生命周期（迁移 067）：库不可用时 available=false，前端一律按「已发布」渲染。
  const [statusMap, setStatusMap] = useState<Map<string, QuestionStatus>>(new Map());
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/learning/question-status");
        if (!response.ok) return;
        const data = (await response.json()) as { statuses?: Array<{ key: string; status: string }> };
        if (!alive || !data.statuses) return;
        setStatusMap(
          new Map(
            data.statuses
              .filter((row) => isQuestionStatus(row.status))
              .map((row) => [row.key, row.status as QuestionStatus])
          )
        );
      } catch {
        // 忽略：状态读不到不影响浏览题目
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const statusOf = useMemo(
    () => (key: string): QuestionStatus => statusMap.get(key) ?? "published",
    [statusMap]
  );

  const visible = useMemo(() => filterLearningQuestions(ALL_QUESTIONS, filters), [filters]);
  const statusVisible = useMemo(() => {
    if (statusFilter === ALL) return visible;
    return visible.filter((item) => statusOf(item.key) === statusFilter);
  }, [visible, statusFilter, statusOf]);
  const facets = useMemo(() => learningQuestionFacets(ALL_QUESTIONS), []);
  const stageOptions = useMemo(() => {
    if (!filters.track) return [];
    return learningQuestionFacets(ALL_QUESTIONS.filter((item) => item.trackSlug === filters.track)).stages;
  }, [filters.track]);

  const set = (patch: Partial<LearningQuestionFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const activeTopicTitle = filters.topic
    ? (ALL_QUESTIONS.find((item) => item.topicKey === filters.topic)?.topicTitle ?? null)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-5 sm:p-7">
      <header className="flex flex-col gap-3">
        <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> 返回技术课程
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ListChecks className="size-6 text-primary" /> 题库总览
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              共 {ALL_QUESTIONS.length} 道题；可按课程、知识点、题型、难度、标签与来源筛选，题干与答案分离展示。
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.keyword ?? ""}
              onChange={(event) => set({ keyword: event.target.value })}
              placeholder="搜索题干、标签、知识点"
              className="pl-9"
              aria-label="搜索题目"
            />
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <FilterRow
          label="课程"
          options={facets.tracks.map((facet) => ({ key: facet.key, label: facet.label, count: facet.count }))}
          value={filters.track ?? ALL}
          onChange={(value) => set({ track: value === ALL ? null : value, stage: null })}
        />
        {stageOptions.length > 1 ? (
          <FilterRow
            label="阶段"
            options={stageOptions.map((facet) => ({ key: facet.key, label: facet.label, count: facet.count }))}
            value={filters.stage ?? ALL}
            onChange={(value) => set({ stage: value === ALL ? null : value })}
          />
        ) : null}
        <FilterRow
          label="题型"
          options={facets.types.map((facet) => ({ key: facet.key, label: facet.label, count: facet.count }))}
          value={filters.type ?? ALL}
          onChange={(value) => set({ type: value === ALL ? null : (value as LearningQuestionFilters["type"]) })}
        />
        <FilterRow
          label="难度"
          options={facets.difficulties.map((facet) => ({ key: facet.key, label: facet.label, count: facet.count }))}
          value={filters.difficulty ?? ALL}
          onChange={(value) =>
            set({ difficulty: value === ALL ? null : (value as LearningQuestionFilters["difficulty"]) })
          }
        />
        {statusMap.size > 0 ? (
          <FilterRow
            label="状态"
            options={(["published", "review", "draft", "archived"] as QuestionStatus[]).map((status) => ({
              key: status,
              label: QUESTION_STATUS_LABEL[status],
              count: ALL_QUESTIONS.filter((item) => statusOf(item.key) === status).length,
            }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        ) : null}
        <FilterRow
          label="来源"
          options={facets.sources.slice(0, 10).map((facet) => ({ key: facet.key, label: facet.key, count: facet.count }))}
          value={filters.source ?? ALL}
          onChange={(value) => set({ source: value === ALL ? null : value })}
        />
        <FilterRow
          label="标签"
          options={facets.tags.slice(0, 14).map((facet) => ({ key: facet.key, label: facet.label, count: facet.count }))}
          value={filters.tag ?? ALL}
          onChange={(value) => set({ tag: value === ALL ? null : value })}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          命中 <span className="font-semibold text-foreground">{statusVisible.length}</span> 道
          {activeTopicTitle ? ` · 知识点「${activeTopicTitle}」` : ""}
        </span>
        {(filters.track || filters.topic || filters.tag || filters.source || filters.type || filters.difficulty) ? (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() =>
              set({ track: null, stage: null, topic: null, type: null, difficulty: null, tag: null, source: null })
            }
          >
            清除筛选
          </button>
        ) : null}
      </div>

      {statusVisible.length === 0 ? (
        <EmptyState icon={Search} title="没有匹配的题目" hint="换个关键词，或清除筛选条件再试。" />
      ) : (
        <div className="flex flex-col gap-3">
          {statusVisible.slice(0, 200).map((item) => (
            <QuestionCard key={item.key} item={item} status={statusOf(item.key)} />
          ))}
          {statusVisible.length > 200 ? (
            <p className="text-center text-xs text-muted-foreground">仅展示前 200 道，请用筛选缩小范围。</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ key: string; label: string; count: number }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <Chip active={value === ALL} onClick={() => onChange(ALL)}>
        全部
      </Chip>
      {options.map((option) => (
        <Chip key={option.key} active={value === option.key} onClick={() => onChange(option.key)}>
          {option.label}
          <span className="ml-1 text-[10px] tabular-nums opacity-70">{option.count}</span>
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionCard({ item, status }: { item: LearningQuestionItem; status: QuestionStatus }) {
  const [revealed, setRevealed] = useState(false);
  const answerSet = new Set(item.answer);
  return (
    <Card className={status !== "published" ? "border-warning/40" : undefined}>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
            style={{ backgroundColor: item.softAccent, color: item.accent }}
          >
            {item.trackTitle}
          </span>
          <Badge variant="outline">{item.type === "judge" ? "判断" : "单选"}</Badge>
          <span>{LEARNING_DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty}</span>
          <span>·</span>
          <span>{item.stageTitle}</span>
          {status !== "published" ? (
            <Badge variant="muted" className="text-warning">{QUESTION_STATUS_LABEL[status]}</Badge>
          ) : null}
        </div>

        <p className="text-sm font-medium leading-relaxed">{item.stem}</p>

        <ul className="flex flex-col gap-1.5">
          {item.options.map((option) => {
            const correct = revealed && answerSet.has(option.key);
            return (
              <li
                key={option.key}
                className={`flex items-start gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  correct ? "border-success/40 bg-success/5" : "border-border/50"
                }`}
              >
                <span className="mt-0.5 font-mono text-xs text-muted-foreground">{option.key}</span>
                <span className="flex-1">{option.text}</span>
                {correct ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : null}
              </li>
            );
          })}
        </ul>

        {revealed ? (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">答案：</span>
              {item.answer.join(" / ")}
            </p>
            <p className="mt-1 leading-relaxed">{item.explanation}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {revealed ? "收起答案" : "显示答案"}
          </button>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.sourceName ? <span>来源：{item.sourceName}</span> : null}
            {item.topicKey ? (
              <Link
                href={`/learn/${item.trackSlug}#kp-${item.topicKey}`}
                className="font-medium text-primary hover:underline"
              >
                回知识点 · {item.topicTitle}
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
