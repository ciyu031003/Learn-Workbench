import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import "katex/dist/katex.min.css";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InlineRichText, MarkdownArticle } from "@/components/exam/markdown-article";
import { StudyToc, StudyTocMobile } from "@/components/exam/study-toc";
import { buildKnowledgeMapPresentation, getExam408KnowledgeMap, isKnowledgeMapBlock } from "@/lib/exam-408-map";
import { exam408PointHref } from "@/lib/exam-408-point-key";
import { decodeStudySlug, getExam408StudyTopic, studyTopicHref } from "@/lib/exam-408-study";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, ExternalLink, Layers3, ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

/** 来源许可要求「不再分发」（db/migrations/085_exam_408_study.sql）：精读正文页不收录 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * 408 精读阅读器（宽屏三栏）。
 *
 *   ┌ 左：本节目录（scrollspy / 阅读进度 / 折叠 / 键盘可达）  260px sticky
 *   ├ 中：正文列 720–780px（15.5px / 行高 1.95，KaTeX 公式排版）
 *   └ 右：本文章信息 / 相邻文章 / 来源与授权  240px
 *
 * xl（≥1280）三栏；lg（1024–1279）两栏（目录 + 正文）；更窄单栏 + 目录抽屉。
 * 容器放宽到 1440px：外层 (learn) layout 的 main 仍是 max-w-5xl，这里用「左偏移 50% + 反向平移」
 * 让阅读器在宽屏上占满可用宽度、同时保持居中对齐（不修改公共 layout）。
 *
 * 公式：正文里的 $...$ 与 $$...$$ 由 markdown-article 用 KaTeX 渲染，katex 只在服务端执行，
 * 因此不进客户端首载包；katex.min.css 在本路由引入，字体由 Next 静态资源管线输出。
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
    <div className="relative left-1/2 w-[min(1440px,calc(100vw-2rem))] -translate-x-1/2 px-1 sm:px-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-xs text-muted-foreground">
        <nav className="flex flex-wrap items-center gap-1.5">
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
          <span className="max-w-[28ch] truncate text-foreground">{topic.title}</span>
        </nav>
        <div className="lg:hidden">
          <StudyTocMobile items={toc} />
        </div>
      </div>

      {/*
        三档栅格（不写死 items-start：让左右两栏跟正文等高，sticky 才有可吸附的滚动行程）：
          lg  1024–1279：目录 220 + 正文（≈748）
          xl  1280–1535：目录 220 + 正文（≈764）+ 信息栏 200
          2xl ≥1536     ：目录 260 + 正文 760 + 信息栏 240，整组居中
      */}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px] 2xl:grid-cols-[260px_minmax(0,760px)_240px] 2xl:justify-center 2xl:gap-8">
        {/* 左栏：目录 */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col">
            <StudyToc items={toc} />
          </div>
        </aside>

        {/* 中栏：正文 */}
        <main className="flex min-w-0 flex-col gap-5">
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
              <h1 className="text-2xl font-semibold leading-snug tracking-tight sm:text-[1.75rem]">{topic.title}</h1>
              {detail.excerpt ? (
                <InlineRichText
                  className="text-sm leading-6 text-muted-foreground"
                  text={detail.excerpt}
                />
              ) : null}
              {topic.knowledgePointKey ? (
                <Link
                  href={exam408PointHref(topic.knowledgePointKey)}
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline xl:hidden"
                >
                  对应知识点与真题 <ChevronRight className="size-3.5" />
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card hover={false} rail="study">
            <CardContent className="p-5 sm:p-8 xl:p-10">
              <MarkdownArticle blocks={detail.blocks} sourceUrl={topic.sourceUrl} knowledgeMap={knowledgeMap} />
            </CardContent>
          </Card>

          {/* 窄屏（<xl）在正文下方保留上一节/下一节与来源；xl 收到右栏 */}
          <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
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

          <Card className="xl:hidden">
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
        </main>

        {/* 右栏：文章信息 / 相邻文章 / 来源 */}
        <aside className="hidden flex-col gap-4 xl:flex">
          <div className="sticky top-6 flex flex-col gap-4">
            <Card>
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ScrollText className="size-3.5" /> 本文章
                </p>
                <dl className="flex flex-col gap-2 text-xs">
                  <InfoRow label="科目" value={detail.subject.title} />
                  <InfoRow label="章节" value={topic.chapter} />
                  <InfoRow label="重要度" value={topic.importanceLabel} />
                  <InfoRow label="阅读时长" value={"约 " + topic.readingMinutes + " 分钟"} />
                  <InfoRow label="真题频次" value={String(topic.examFrequency) + " 次"} />
                </dl>
                {topic.knowledgePointKey ? (
                  <Link
                    href={exam408PointHref(topic.knowledgePointKey)}
                    className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    对应知识点与真题 <ChevronRight className="size-3.5" />
                  </Link>
                ) : null}
              </CardContent>
            </Card>

            {detail.prev || detail.next ? (
              <Card>
                <CardContent className="flex flex-col gap-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">相邻文章</p>
                  {detail.prev ? (
                    <Link
                      href={studyTopicHref(detail.prev.slug)}
                      className="group flex items-start gap-1.5 rounded-lg px-1.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    >
                      <ChevronLeft className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                      <span className="min-w-0">
                        <span className="block text-[11px] text-muted-foreground">上一节</span>
                        <span className="line-clamp-2 block font-medium text-foreground/90">{detail.prev.title}</span>
                      </span>
                    </Link>
                  ) : null}
                  {detail.next ? (
                    <Link
                      href={studyTopicHref(detail.next.slug)}
                      className="group flex items-start justify-end gap-1.5 rounded-lg px-1.5 py-1 text-right text-xs transition-colors hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] text-muted-foreground">下一节</span>
                        <span className="line-clamp-2 block font-medium text-foreground/90">{detail.next.title}</span>
                      </span>
                      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="flex flex-col gap-1.5 p-4 text-[11px] leading-5 text-muted-foreground">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">来源与授权</p>
                <p>
                  {detail.source.name}（{detail.source.baseUrl}）。{detail.source.licenseNote}
                </p>
                {topic.sourceUrl ? (
                  <a
                    href={topic.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 font-medium text-primary hover:underline"
                  >
                    查看原文 <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground/90">{value}</dd>
    </div>
  );
}
