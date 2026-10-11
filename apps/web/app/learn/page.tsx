"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { learningCategories, learningTracks } from "@learn-workbench/content";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LearningMastery } from "@/components/learning/mastery-badge";
import { trackStats } from "@/lib/learning-stats";
import { BookOpen, ChevronRight, GraduationCap, ListChecks, Search } from "lucide-react";

type CategoryFilter = "全部" | string;

export default function LearnLibraryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("全部");

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return learningTracks.filter((track) => {
      if (category !== "全部" && track.category !== category) return false;
      if (!keyword) return true;
      const haystack = [
        track.title,
        track.category,
        track.summary,
        track.whyLearn,
        ...track.stages.flatMap((stage) => [
          stage.title,
          stage.goal,
          stage.outcome,
          ...stage.topics.flatMap((topic) => [
            topic.title,
            topic.summary,
            ...topic.concepts,
            ...(topic.lesson?.overview ?? []),
          ]),
        ]),
        // 阶段 14（Phase G）：搜索面覆盖配套题题干，按题干也能找到课程
        ...track.questions.map((question) => question.stem),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [category, query]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of learningTracks) {
      counts.set(track.category, (counts.get(track.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  const matchingQuestions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    return learningTracks.flatMap((track) =>
      track.questions
        .filter((question) => question.stem.toLowerCase().includes(keyword))
        .map((question) => ({ track, question }))
    );
  }, [query]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="size-6 text-primary" /> 技术课程
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {learningTracks.length} 门课程的完整大纲与深度知识点；数字来自内容包真实统计，掌握度按可解释口径计算。
          </p>
        </div>
        <div className="flex w-full max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索课程、知识点、题干"
              className="pl-9"
              aria-label="搜索技术课程"
            />
          </div>
          <Link
            href="/learn/questions"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <ListChecks className="size-4" /> 题库
          </Link>
        </div>
      </header>

      <Link
        href="/learn/408"
        className="group flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:border-primary/40 hover:bg-primary/8 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">408 考研专项</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              四科知识体系、99 个知识点与 2009–2026 年原卷真题，按章节或年份进入
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          打开专区 <ChevronRight className="size-3.5" />
        </span>
      </Link>

      {query.trim() && matchingQuestions.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/40 p-4">
          <p className="text-xs font-semibold text-muted-foreground">
            题干命中 {matchingQuestions.length} 道题
          </p>
          <ul className="flex flex-col gap-1">
            {matchingQuestions.slice(0, 6).map(({ track, question }) => (
              <li key={question.key} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="shrink-0">{track.title}</Badge>
                <span className="min-w-0 flex-1 text-muted-foreground">{question.stem}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`/learn/questions?q=${encodeURIComponent(query.trim())}`}
            className="self-start text-xs font-medium text-primary hover:underline"
          >
            在题库总览中查看全部命中 →
          </Link>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>分类</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="按分类筛选课程"
            className="paper-select h-9 rounded-lg px-2 text-sm"
          >
            <option value="全部">全部（{learningTracks.length} 门）</option>
            {learningCategories.map((item) => (
              <option key={item} value={item}>
                {item}（{categoryCounts.get(item) ?? 0} 门）
              </option>
            ))}
          </select>
        </label>
        {category !== "全部" ? (
          <button
            type="button"
            onClick={() => setCategory("全部")}
            className="text-xs font-medium text-primary hover:underline"
          >
            清除筛选
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            共 {learningCategories.length} 个方向 · {learningTracks.length} 门课程
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="没有匹配的课程"
          hint="试试 Python、Java、JavaScript、Linux 或 AI 工程。"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((track) => {
            const stats = trackStats(track);
            const isExam408 = track.slug === "ex-408-grad";
            return (
              <Card key={track.slug} rail="study" className="flex flex-col">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">
                        {isExam408 ? "408 考研专项" : track.title}
                      </h2>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="outline">{track.category}</Badge>
                        <span>{track.level}</span>
                        <span>·</span>
                        <span>约 {track.estimatedHours} 小时</span>
                      </p>
                    </div>
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: track.softAccent, color: track.accent }}
                    >
                      <GraduationCap className="size-4.5" />
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {isExam408
                      ? "四科知识体系与历年原卷真题：章节知识点、完整题型、原题号、配图与参考答案。"
                      : track.summary}
                  </p>

                  <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2 text-center">
                    <Stat label={isExam408 ? "科目" : "阶段"} value={isExam408 ? 4 : stats.stages} />
                    <Stat label="知识点" value={isExam408 ? 99 : stats.topics} />
                    <Stat label="配套题" value={isExam408 ? 846 : stats.questions} />
                  </dl>

                  <LearningMastery trackSlug={track.slug} />

                  <Link
                    href={isExam408 ? "/learn/408" : `/learn/${track.slug}`}
                    className="mt-auto inline-flex h-9 items-center justify-center rounded-lg bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    {isExam408 ? "进入 408 专区" : "查看课程大纲"}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
