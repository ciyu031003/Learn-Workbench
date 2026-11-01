"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GlassModal } from "@/components/ui/modal";
import { Exam408SearchDialog } from "@/components/exam/search-dialog";
import type { Exam408ChapterSummary, Exam408Overview, Exam408SubjectSummary } from "@/lib/exam-408";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  FileText,
  Layers3,
  MonitorCheck,
  Network,
  PanelsTopLeft,
} from "lucide-react";

const SUBJECT_STYLE: Record<string, { color: string; soft: string; icon: typeof BookOpen }> = {
  "data-structure": { color: "#2563eb", soft: "#dbeafe", icon: Layers3 },
  "computer-organization": { color: "#7c3aed", soft: "#ede9fe", icon: MonitorCheck },
  "operating-system": { color: "#b45309", soft: "#fef3c7", icon: PanelsTopLeft },
  "computer-network": { color: "#0f766e", soft: "#ccfbf1", icon: Network },
};

type HubTab = "knowledge" | "papers";

export function Exam408Hub({ overview }: { overview: Exam408Overview }) {
  const [tab, setTab] = useState<HubTab>("knowledge");
  const [subjectKey, setSubjectKey] = useState(overview.subjects[0]?.key ?? "");
  const [chapter, setChapter] = useState<Exam408ChapterSummary | null>(null);
  const subject = useMemo(
    () => overview.subjects.find((item) => item.key === subjectKey) ?? overview.subjects[0],
    [overview.subjects, subjectKey],
  );
  const papers = useMemo(() => [...overview.papers].sort((a, b) => b.year - a.year), [overview.papers]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 sm:p-7 2xl:max-w-[1800px]">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> 技术课程
        </Link>
        <span>/</span>
        <span className="text-foreground">408 考研专项</span>
      </nav>

      <Card rail="study">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <Badge variant="default">考研计算机 · 计算机学科专业基础</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">408 知识体系与历年真题</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              四门科目按章节组织 99 个知识点，保留 2009–2026 年原卷题号、题型、分值、配图与参考答案。先读章节，再按年份整套刷。
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Exam408SearchDialog />
              <span className="text-xs text-muted-foreground">
                搜知识点、精读标题、速记卡与真题题干（⌘K / Ctrl+K）
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5 lg:min-w-[440px]">
            <Stat label="科目" value={overview.stats.subjects} />
            <Stat label="章节" value={overview.stats.chapters} />
            <Stat label="知识点" value={overview.stats.points} />
            <Stat label="年份" value={overview.stats.papers} />
            <Stat label="题目" value={overview.stats.questions} />
          </dl>
        </CardContent>
      </Card>

      <Link
        href="/learn/408/study"
        className="group flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4 transition-colors hover:border-primary/40 hover:bg-primary/10 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <BookOpen className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold">知识精读</span>
              <Badge variant="muted">cs408 精读 · 教材式正文</Badge>
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              按科目与章节读教材式正文：公式、插图、章节目录与上一节／下一节，读完再回来刷该知识点真题。
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
          进入精读 <ChevronRight className="size-3.5" />
        </span>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/learn/408/viz"
          className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent-foreground">
            <Clapperboard className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="text-sm font-semibold">交互演示</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              排序 / 树 / 图 / 调度 / 置换等 98 个演示，单步、拖动、倍速，配逐步讲解。
            </span>
          </span>
          <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </Link>
        <Link
          href="/learn/408/drill"
          className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Layers3 className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="text-sm font-semibold">刷卡背诵</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              529 张速记卡：到期队列 + 三档自评 + 易错本，FSRS 安排复习。
            </span>
          </span>
          <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 sm:max-w-md">
        <TabButton active={tab === "knowledge"} onClick={() => setTab("knowledge")} icon={<BookOpen className="size-4" />}>
          四科知识体系
        </TabButton>
        <TabButton active={tab === "papers"} onClick={() => setTab("papers")} icon={<FileText className="size-4" />}>
          历年真题
        </TabButton>
      </div>

      {tab === "knowledge" ? (
        <section className="flex flex-col gap-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {overview.subjects.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSubjectKey(item.key)}
                aria-pressed={subject?.key === item.key}
                className={`min-w-[150px] rounded-lg border px-3 py-2 text-left transition-colors ${
                  subject?.key === item.key
                    ? "border-primary/35 bg-primary/10"
                    : "border-border/60 bg-card/60 hover:border-primary/25"
                }`}
              >
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {item.chapterCount} 章 · {item.pointCount} 知识点 · {item.questionCount} 题
                </span>
              </button>
            ))}
          </div>

          {subject ? <SubjectChapters subject={subject} onOpenChapter={setChapter} /> : null}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">历年真题</h2>
              <p className="text-sm text-muted-foreground">按年份打开原卷，保留题型、题号、分值与顺序。</p>
            </div>
            <Badge variant="muted">{papers.length} 套</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {papers.map((paper) => (
              <Link
                key={paper.year}
                href={`/learn/408/papers/${paper.year}`}
                className="group rounded-xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{paper.year}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {paper.questionCount} 题 · {paper.totalScore} 分
                    </p>
                  </div>
                  <CalendarDays className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{paper.title}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  打开原卷 <ChevronRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">内容来源与使用边界</p>
          <p>
            来源：{overview.source.name}（{overview.source.baseUrl}）。{overview.source.licenseNote}
          </p>
          <p>本站只保存在个人学习工作台数据库，不提供商用分发；题目图片已本地化，视频讲解仍打开原站。</p>
        </CardContent>
      </Card>

      <GlassModal
        open={chapter !== null}
        onClose={() => setChapter(null)}
        title={chapter ? `${subject?.shortName ?? ""} · ${chapter.title}` : "章节知识点"}
        className="max-w-2xl max-sm:max-h-[82dvh] max-sm:max-w-none max-sm:self-end max-sm:rounded-b-none max-sm:bg-card max-sm:backdrop-blur-none"
      >
        {chapter ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline">第 {chapter.chapterNumber} 章</Badge>
              <Badge variant="muted">{chapter.points.length} 个知识点</Badge>
              <Badge variant="muted">{chapter.questionCount} 道题</Badge>
            </div>
            <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
              {chapter.points.map((point) => (
                <Link
                  key={point.key}
                  href={`/learn/408/points/${point.key}`}
                  className="flex items-start gap-3 bg-card/50 px-3 py-3 transition-colors hover:bg-primary/5"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {point.pointNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{point.title}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {point.tags
                        .filter((tag) => tag !== "408" && tag !== "四〇八档案室")
                        .slice(0, 4)
                        .map((tag) => (
                          <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{point.questionCount} 题</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </GlassModal>
    </div>
  );
}

function SubjectChapters({
  subject,
  onOpenChapter,
}: {
  subject: Exam408SubjectSummary;
  onOpenChapter: (chapter: Exam408ChapterSummary) => void;
}) {
  const style = SUBJECT_STYLE[subject.key.split("/").at(-1) ?? ""] ?? SUBJECT_STYLE["data-structure"];
  const Icon = style.icon;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: style.soft, color: style.color }}>
            <Icon className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{subject.title}</h2>
            <p className="text-xs text-muted-foreground">
              {subject.chapterCount} 章 · {subject.pointCount} 个知识点 · {subject.questionCount} 道题
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">点击章节查看知识点清单</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {subject.chapters.map((chapter) => {
          const preview = chapter.points.slice(0, 4).map((point) => point.title);
          return (
            <button
              key={chapter.key}
              type="button"
              onClick={() => onOpenChapter(chapter)}
              aria-label={`打开第 ${chapter.chapterNumber} 章 ${chapter.title}`}
              className="group rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold" style={{ backgroundColor: style.soft, color: style.color }}>
                  {String(chapter.chapterNumber).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{chapter.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {chapter.points.length} 个知识点 · {chapter.questionCount} 道题
                  </span>
                  <span className="mt-2 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {preview.join("、")}
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
