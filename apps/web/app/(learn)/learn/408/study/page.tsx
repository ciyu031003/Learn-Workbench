import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getExam408StudyOverview, studyTopicHref } from "@/lib/exam-408-study";
import { ArrowLeft, BookOpen, ChevronRight, Clock, Layers3 } from "lucide-react";

export const dynamic = "force-dynamic";

/** 来源许可要求「不再分发」（db/migrations/085_exam_408_study.sql）：精读正文页不收录 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * 408 精读列表：科目 → 章节 → 文章。
 *
 * 这是「阅读体验升级」的入口页：不堆题目，只把 181 篇精读正文按科目/章节摊开，
 * 每篇给出重要度、真题频次与预计阅读时长，点进去是左目录 + 右正文的阅读器。
 */
export default async function Exam408StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject: subjectParam } = await searchParams;
  const overview = await getExam408StudyOverview();
  const withTopics = overview.subjects.filter((item) => item.topicCount > 0);
  const active =
    withTopics.find((item) => item.key === subjectParam) ?? withTopics[0] ?? overview.subjects[0];
  const readingMinutes = overview.stats.readingMinutes;
  const readingHours = Math.max(1, Math.round(readingMinutes / 60));

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 sm:p-7 2xl:max-w-[1800px]">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> 技术课程
        </Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">408 考研专项</Link>
        <span>/</span>
        <span className="text-foreground">知识精读</span>
      </nav>

      <Card rail="study">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <Badge variant="default">cs408 精读 · 已获作者授权（个人学习、非商业）</Badge>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              <BookOpen className="size-6 text-primary" />
              408 知识精读
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              四门科目按章节整理的 {overview.stats.topics} 篇教材式正文，含公式、插图与一张章节目录。
              每篇先读正文，再回到对应知识点刷真题；比只看一句摘要更能建立体系。
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center lg:min-w-[300px]">
            <Stat label="文章" value={overview.stats.topics} />
            <Stat label="章节" value={overview.stats.chapters} />
            <Stat label="预计阅读" value={readingHours} unit="小时" />
          </dl>
        </CardContent>
      </Card>

      {overview.stats.topics > 0 ? (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {overview.subjects.map((item) => {
              const isActive = active?.key === item.key;
              const disabled = item.topicCount === 0;
              return (
                <Link
                  key={item.key}
                  href={"/learn/408/study?subject=" + encodeURIComponent(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  aria-disabled={disabled || undefined}
                  className={
                    "min-w-[160px] rounded-lg border px-3 py-2 text-left transition-colors " +
                    (isActive
                      ? "border-primary/35 bg-primary/10"
                      : "border-border/60 bg-card/60 hover:border-primary/25")
                  }
                >
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {item.chapterCount} 章 · {item.topicCount} 篇
                    {item.readingMinutes > 0 ? " · 约 " + Math.max(1, Math.round(item.readingMinutes / 60)) + " 小时" : null}
                  </span>
                </Link>
              );
            })}
          </div>

          {active && active.topicCount > 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{active.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {active.chapterCount} 章 · {active.topicCount} 篇 · 预计{" "}
                    {Math.max(1, Math.round(active.readingMinutes / 60))} 小时读完
                  </p>
                </div>
                <Link href="/learn/408" className="text-xs font-medium text-primary hover:underline">
                  返回 408 专区
                </Link>
              </div>

              <div className="flex flex-col gap-3">
                {active.chapters.map((chapter, chapterIndex) => (
                  <div key={chapter.chapter + chapter.chapterOrder} className="rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                          {String(chapterIndex + 1).padStart(2, "0")}
                        </span>
                        {chapter.chapter}
                      </h3>
                      <span className="text-[11px] text-muted-foreground">{chapter.topics.length} 篇</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                      {chapter.topics.map((topic) => (
                        <Link
                          key={topic.slug}
                          href={studyTopicHref(topic.slug)}
                          className="group flex items-start gap-2 rounded-lg border border-border/50 bg-card/70 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 block text-sm font-medium leading-6">{topic.title}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Badge
                                variant={
                                  topic.importance === "must"
                                    ? "default"
                                    : topic.importance === "common"
                                      ? "warning"
                                      : "muted"
                                }
                              >
                                {topic.importanceLabel}
                              </Badge>
                              {topic.examFrequency > 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <Layers3 className="size-3" /> 真题 {topic.examFrequency}
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-0.5">
                                <Clock className="size-3" /> {topic.readingMinutes} 分钟
                              </span>
                            </span>
                          </span>
                          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-2 p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">精读正文正在导入</p>
            <p>
              库里还没有 exam_408_study_topics 记录（迁移 085 与导入脚本 scripts/cs408-study/import.mjs）。
              导入完成后本页会自动出现 181 篇正文，无需改代码。
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-1.5 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">内容来源与使用边界</p>
          <p>
            来源：{overview.source.name}（{overview.source.baseUrl}）。{overview.source.licenseNote}
          </p>
          <p>本站只作个人学习阅读，不提供商用分发；插图已本地化，交互图谱保留原文站入口。</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{unit}</span> : null}
      </dd>
    </div>
  );
}
