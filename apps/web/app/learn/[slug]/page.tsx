"use client";

import { use, type ReactNode } from "react";
import Link from "next/link";
import { getLearningTrack, type LearningTopic, type LearningTrack } from "@learn-workbench/content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LearningMastery } from "@/components/learning/mastery-badge";
import { LEARNING_DIFFICULTY_LABEL, stageStats, topicQuestions, trackStats } from "@/lib/learning-stats";
import { ArrowLeft, BookOpen, CheckCircle2, ListChecks, Sparkles, TriangleAlert, Wrench } from "lucide-react";

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const track = getLearningTrack(slug);

  if (!track) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <BookOpen className="size-7 text-muted-foreground" />
        <h1 className="text-lg font-semibold">没有这门课程</h1>
        <p className="text-sm text-muted-foreground">课程不存在或已下线。</p>
        <Link href="/learn" className="mt-1 text-sm font-medium text-primary hover:underline">
          返回技术课程
        </Link>
      </div>
    );
  }

  const stats = trackStats(track);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-5 sm:p-7">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">技术课程</Link>
        <span>/</span>
        <span>{track.category}</span>
        <span>/</span>
        <span className="text-foreground">{track.title}</span>
      </nav>

      <Card rail="study">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{track.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline">{track.category}</Badge>
                <span>{track.level}</span>
                <span>·</span>
                <span>约 {track.estimatedHours} 小时</span>
                <span>·</span>
                <span>{stats.stages} 阶段 / {stats.topics} 知识点 / {stats.questions} 题</span>
              </p>
            </div>
            <LearningMastery trackSlug={track.slug} className="shrink-0" />
          </div>

          <p className="text-sm text-muted-foreground">{track.summary}</p>
          <Section title="学完能做什么" icon={<Sparkles className="size-4 text-primary" />}>
            <p className="text-sm text-muted-foreground">{track.whyLearn}</p>
          </Section>
          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="前置知识" icon={<ListChecks className="size-4 text-primary" />}>
              <div className="flex flex-wrap gap-1.5">
                {track.prerequisites.map((item) => (
                  <Badge key={item} variant="muted">{item}</Badge>
                ))}
              </div>
            </Section>
            <Section title="学习方法" icon={<Wrench className="size-4 text-primary" />}>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {track.studyMethod.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">课程大纲</h2>
        <span className="text-xs text-muted-foreground">展开阶段查看知识点与配套题</span>
      </div>

      <div className="flex flex-col gap-3">
        {track.stages.map((stage, index) => {
          const scoped = stageStats(track, stage.key);
          return (
            <details key={stage.key} className="group rounded-xl border border-border/60 bg-card/60">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{stage.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {stage.weeks} · {scoped.topics} 知识点 · {scoped.questions} 题
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground group-open:hidden">展开</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground group-open:inline">收起</span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-border/50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Labeled label="本章目标" text={stage.goal} />
                  <Labeled label="本章验收" text={stage.outcome} />
                </div>
                {stage.lesson ? <StageLesson track={track} lesson={stage.lesson} /> : null}
                <ol className="flex flex-col gap-2">
                  {stage.topics.map((topic, topicIndex) => (
                    <li key={topic.key}>
                      <TopicCard track={track} topic={topic} index={topicIndex} />
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">内容来源与许可</h2>
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {track.sources.map((source) => (
              <li key={source.key} className="flex flex-wrap items-center gap-1.5">
                <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                  {source.name}
                </a>
                <Badge variant="outline">{source.license}</Badge>
                <Badge variant="muted">{source.usage === "import" ? "可复用" : "仅参考"}</Badge>
                <span>{source.note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Link href="/learn" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" /> 返回技术课程
      </Link>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function Labeled({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{text}</p>
    </div>
  );
}

function StageLesson({ track, lesson }: { track: LearningTrack; lesson: NonNullable<LearningTrack["stages"][number]["lesson"]> }) {
  void track;
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground">这一阶段怎么学</p>
      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {lesson.overview.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <ol className="flex flex-col gap-1.5">
        {lesson.studyLoop.map((item, index) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
      <div className="grid gap-2 sm:grid-cols-2">
        {lesson.milestones.map((milestone) => (
          <div key={milestone.title} className="rounded-lg border border-border/50 p-2.5">
            <p className="text-sm font-medium">{milestone.title}</p>
            <p className="text-xs text-muted-foreground">{milestone.evidence}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-success/10 p-3">
        <p className="text-xs font-semibold text-success-strong">阶段完成标准</p>
        <ul className="mt-1 space-y-1">
          {lesson.completionCriteria.map((item) => (
            <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TopicCard({ track, topic, index }: { track: LearningTrack; topic: LearningTopic; index: number }) {
  const questions = topicQuestions(track, topic.key);
  return (
    <details className="group rounded-lg border border-border/50 bg-background/40">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 p-3">
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{topic.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{topic.summary}</span>
        </span>
        <Badge variant="muted" className="shrink-0">{questions.length} 题</Badge>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border/50 p-3">
        <div className="flex flex-wrap gap-1.5">
          {topic.concepts.map((concept) => (
            <Badge key={concept} variant="outline">{concept}</Badge>
          ))}
        </div>

        {topic.lesson ? (
          <>
            <Block title="深入理解" items={topic.lesson.overview} />
            <Block title="运作机制" items={topic.lesson.mechanism} />
            <div className="rounded-lg border border-border/50 bg-muted/40">
              <p className="border-b border-border/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {topic.lesson.example.title} · {topic.lesson.example.language}
              </p>
              <pre className="overflow-x-auto p-3">
                <code className="font-mono text-xs leading-relaxed">{topic.lesson.example.code}</code>
              </pre>
              <p className="px-3 pb-3 text-xs text-muted-foreground">{topic.lesson.example.explanation}</p>
            </div>
            <Block title="练习路径" items={topic.lesson.practiceSteps} />
          </>
        ) : null}

        <Block title="原理" items={topic.principles} />
        <Block title="应用场景" items={topic.applications} />
        <Block title="常见误区" items={topic.pitfalls} danger />
        <div className="flex flex-col gap-1 rounded-lg bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">怎么学</p>
          <p className="text-sm text-muted-foreground">{topic.method}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground">动手练习</p>
          <p className="text-sm text-muted-foreground">{topic.exercise}</p>
          {topic.lesson ? (
            <ul className="mt-1 flex flex-col gap-1">
              {topic.lesson.masteryChecklist.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary/70" /> {item}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> 掌握检查：{topic.checkpoint}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground">配套题目（{questions.length}）</p>
          <ul className="flex flex-col gap-1.5">
            {questions.map((question) => (
              <li key={question.key} className="flex items-start gap-2 rounded-lg border border-border/50 p-2.5">
                <Badge variant="outline" className="shrink-0">{question.type === "judge" ? "判断" : "单选"}</Badge>
                <Badge variant="muted" className="shrink-0">{LEARNING_DIFFICULTY_LABEL[question.difficulty] ?? question.difficulty}</Badge>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">{question.stem}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">答案与解析在 App 内作答时给出，作答会写入掌握度与复习队列。</p>
        </div>
      </div>
    </details>
  );
}

function Block({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${danger ? "text-danger" : "text-muted-foreground"}`}>
        {danger ? <TriangleAlert className="size-3.5" /> : null} {title}
      </p>
      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
