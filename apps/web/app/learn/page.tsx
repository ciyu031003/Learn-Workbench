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
import { BookOpen, GraduationCap, Search } from "lucide-react";

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
        ...track.stages.flatMap((stage) => [stage.title, stage.goal, ...stage.topics.map((topic) => topic.title)]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [category, query]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="size-6 text-primary" /> 技术课程
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            7 个方向的课程大纲与深度知识点；数字来自内容包真实统计，掌握度按可解释口径计算。
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 Python、Java、Linux、AI"
            className="pl-9"
            aria-label="搜索技术课程"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {["全部", ...learningCategories].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            aria-pressed={item === category}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              item === category
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
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
            return (
              <Card key={track.slug} rail="study" className="flex flex-col">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{track.title}</h2>
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

                  <p className="text-sm text-muted-foreground">{track.summary}</p>

                  <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2 text-center">
                    <Stat label="阶段" value={stats.stages} />
                    <Stat label="知识点" value={stats.topics} />
                    <Stat label="配套题" value={stats.questions} />
                  </dl>

                  <LearningMastery trackSlug={track.slug} />

                  <Link
                    href={`/learn/${track.slug}`}
                    className="mt-auto inline-flex h-9 items-center justify-center rounded-lg bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    查看课程大纲
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
