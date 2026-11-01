import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownArticle } from "@/components/exam/markdown-article";
import { buildKnowledgeMapPresentation, getExam408KnowledgeMap, isKnowledgeMapBlock } from "@/lib/exam-408-map";
import { decodeStudySlug, getExam408StudyTopic, studyTopicHref } from "@/lib/exam-408-study";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, ExternalLink, Layers3, ListTree } from "lucide-react";

export const dynamic = "force-dynamic";

/** 来源许可要求「不再分发」（db/migrations/085_exam_408_study.sql）：精读正文页不收录 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * 408 精读阅读器：桌面「左目录 + 右正文」，移动端「单列 + 折叠锚点目录」。
 *
 * 版面上刻意减小信息密度：正文卡片加宽留白、行高 1.9、标题可锚点跳转，
 * 底部保留来源署名与原文链接（授权要求），并提供「上一节 / 下一节」把 181 篇串成阅读流。
 */
export default async function Exam408StudyArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // cs408 的 slug 含中文（如 data_structure-绪论-knowledge-map），App Router 传入的可能是百分号编码
  const decodedSlug = decodeStudySlug(slug);
  const detail = await getExam408StudyTopic(decodedSlug);
  if (!detail) notFound();

  const topic = detail.topic;
  const toc = detail.toc;
  // 「章节知识图谱」文章：取迁移 088 的图谱数据，在服务端预计算布局/折行/统计后交给正文渲染器自绘
  const mapRecord = detail.blocks.some((block) => isKnowledgeMapBlock(block))
    ? await getExam408KnowledgeMap({ topicSlug: decodedSlug })
    : null;
  const knowledgeMap = mapRecord ? buildKnowledgeMapPresentation(mapRecord) : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-7">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> 技术课程
        </Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">408 考研专项</Link>
        <span>/</span>
        <Link href={"/learn/408/study?subject=" + encodeURIComponent(detail.subject.key)} className="hover:text-foreground">
          知识精读
        </Link>
        <span>/</span>
        <span className="text-foreground">正文</span>
      </nav>

      <Card rail="study">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{detail.subject.title}</Badge>
            <Badge variant="outline">{topic.chapter}</Badge>
            <Badge variant={topic.importance === "must" ? "default" : topic.importance === "common" ? "warning" : "muted"}>
              {topic.importanceLabel}
            </Badge>
            {topic.examFrequency > 0 ? (
              <Badge variant="muted">
                <Layers3 className="size-3" /> 真题频次 {topic.examFrequency}
              </Badge>
            ) : null}
            <Badge variant="muted">
              <Clock className="size-3" /> 约 {topic.readingMinutes} 分钟
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">{topic.title}</h1>
          {detail.excerpt ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{detail.excerpt}</p>
          ) : null}
          {topic.knowledgePointKey ? (
            <Link
              href={"/learn/408/points/" + topic.knowledgePointKey}
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              对应知识点与真题 <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {toc.length > 0 ? (
        <details className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <ListTree className="size-4 text-primary" /> 本节目录（{toc.length}）
          </summary>
          <ol className="mt-2 flex flex-col gap-1">
            {toc.map((item) => (
              <li key={item.id} className={item.level >= 3 ? "pl-3" : undefined}>
                <a href={"#" + item.id} className="text-muted-foreground hover:text-primary">
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className={toc.length > 0 ? "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]" : "grid gap-6"}>
        {toc.length > 0 ? (
          <aside className="hidden lg:block">
            <div className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col gap-2 overflow-y-auto pr-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ListTree className="size-3.5" /> 本节目录
              </p>
              <ol className="flex flex-col gap-1 border-l border-border/60 pl-3 text-sm">
                {toc.map((item) => (
                  <li key={item.id} className={item.level >= 3 ? "pl-3" : undefined}>
                    <a href={"#" + item.id} className="block py-0.5 text-muted-foreground transition-colors hover:text-primary">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        ) : null}

        <div className="min-w-0">
          <Card hover={false} rail="study">
            <CardContent className="p-5 sm:p-8">
              <MarkdownArticle blocks={detail.blocks} sourceUrl={topic.sourceUrl} knowledgeMap={knowledgeMap} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {detail.prev ? (
          <Link
            href={studyTopicHref(detail.prev.slug)}
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground">上一节 · {detail.prev.chapter}</span>
              <span className="mt-0.5 line-clamp-2 block text-sm font-medium">{detail.prev.title}</span>
            </span>
          </Link>
        ) : (
          <div />
        )}
        {detail.next ? (
          <Link
            href={studyTopicHref(detail.next.slug)}
            className="group flex items-center justify-end gap-3 rounded-xl border border-border/60 bg-card/60 p-4 text-right transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground">下一节 · {detail.next.chapter}</span>
              <span className="mt-0.5 line-clamp-2 block text-sm font-medium">{detail.next.title}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        ) : (
          <div />
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1.5 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">来源与授权</p>
          <p>
            本文来自 {detail.source.name}（{detail.source.baseUrl}）。{detail.source.licenseNote}
          </p>
          {topic.sourceUrl ? (
            <a
              href={topic.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-primary hover:underline"
            >
              查看原文 <ExternalLink className="size-3" />
            </a>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
