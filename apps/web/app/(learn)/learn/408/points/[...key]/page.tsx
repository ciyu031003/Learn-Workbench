import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  PointCardsSection,
  PointDemosSection,
  PointQuestionsSection,
  PointResourceOverview,
  PointStudySection,
  type PointArticleCard,
  type PointDemoCard,
} from "@/components/exam/point-resources";
import { RichText } from "@/components/rich-text";
import { getExam408Point } from "@/lib/exam-408";
import { internalizePointKey, isExam408PointKey } from "@/lib/exam-408-point-key";
import { getExam408Demo, type Exam408DemoSummary } from "@/lib/exam-408-demos";
import { getExam408StudyTopic } from "@/lib/exam-408-study";
import { getExam408Topic } from "@/lib/exam-408-topic";

export const dynamic = "force-dynamic";

/** 来源许可要求「不再分发」（db/migrations/071_exam_408_content.sql:226）：知识点页不收录 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** 精读摘要最多为前几篇取正文首段（每篇一次轻查询，超出部分不取，避免页面被 N+1 拖慢） */
const MAX_ARTICLE_EXCERPTS = 4;
/** 演示首帧最多取前几个（每个一条 detail 查询）；其余只显示「首帧待抓取」占位 */
const MAX_DEMO_FRAMES = 4;

/**
 * 408 知识点聚合页（v1.55 / P3 收口）。
 *
 * 数据：getExam408Point（正文 + 真题 + 来源，保持原有语义）与 getExam408Topic
 * （精读 / 速记卡 / 演示 / 真题 四类关联资源，task-17 的映射结果）。
 * 页面结构：hero（含四类资源数量）→ 正文 → 精读 → 演示 → 速记卡 → 按年份折叠的真题 → 来源。
 *
 * 为什么真题默认折叠：单个知识点最多十几道大题，展开后页面接近 8000px；
 * 折叠 + 分年份既保住「/point 一页看全」的语义，又不让首屏被真题吞掉。
 */
export default async function Exam408PointPage({
  params,
}: {
  params: Promise<{ key: string[] }>;
}) {
  const { key } = await params;
  const rawKey = key.join("/");
  // P7：页面 URL 用 yuanabd-408/*，旧链接（beokayy-408/*）继续 200；查库前统一 internalize
  const pointKey = internalizePointKey(rawKey);
  if (!isExam408PointKey(rawKey)) notFound();
  const [detail, topic] = await Promise.all([
    getExam408Point(pointKey),
    getExam408Topic(pointKey).catch(() => null),
  ]);
  if (!detail) notFound();

  const articles = topic?.articles ?? [];
  const demos = topic?.demos ?? [];
  const cards = topic?.cards ?? [];
  const questions = topic && topic.questions.length > 0 ? topic.questions : detail.questions;

  const articleCards: PointArticleCard[] = await Promise.all(
    articles.slice(0, MAX_ARTICLE_EXCERPTS).map(async (article) => ({
      article,
      excerpt: await getExam408StudyTopic(article.slug)
        .then((articleDetail) => articleDetail?.excerpt ?? "")
        .catch(() => ""),
    })),
  );
  articleCards.push(...articles.slice(MAX_ARTICLE_EXCERPTS).map((article) => ({ article, excerpt: "" })));

  const demoCards: PointDemoCard[] = await Promise.all(
    demos.slice(0, MAX_DEMO_FRAMES).map(async (demo: Exam408DemoSummary) => {
      const full = await getExam408Demo(demo.key).catch(() => null);
      const frame = full?.steps.map((step) => step.frame).find((item): item is string => Boolean(item)) ?? null;
      return { demo, frame };
    }),
  );
  demoCards.push(...demos.slice(MAX_DEMO_FRAMES).map((demo) => ({ demo, frame: null })));

  const counts = {
    articles: articles.length,
    cards: cards.length,
    demos: demos.length,
    questions: questions.length,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 sm:p-7 2xl:max-w-[1800px]">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">技术课程</Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">408 考研专项</Link>
        <span>/</span>
        <span>{detail.point.subject.title}</span>
        <span>/</span>
        <span className="text-foreground">{detail.point.title}</span>
      </nav>

      <Card rail="study">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{detail.point.subject.title}</Badge>
              <Badge variant="outline">{detail.point.chapter.title}</Badge>
              <Badge variant="muted">第 {detail.point.chapter.chapterNumber} 章 · 知识点</Badge>
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <BookOpen className="size-6 text-primary" />
              {detail.point.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <RichText text={detail.point.summary} />
            </p>
          </div>
          <PointResourceOverview counts={counts} />
          <div className="flex flex-wrap gap-1.5">
            {detail.point.tags.map((tag) => (
              <Badge key={tag} variant="muted">{tag}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {detail.point.body.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ScrollText className="size-4 text-primary" />
              知识点正文
            </h2>
            <div className="mx-auto flex w-full max-w-[820px] flex-col gap-2.5">
              {detail.point.body.map((paragraph, index) => (
                <p
                  key={index}
                  className={
                    paragraph.startsWith("【")
                      ? "text-sm font-medium leading-7 text-foreground/90"
                      : "text-sm leading-7 text-foreground/90"
                  }
                >
                  <RichText text={paragraph} />
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">本页把「精读 / 演示 / 速记卡 / 真题」按学习顺序串在一起</span>
        <Link href="/learn/408" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <ArrowLeft className="size-3.5" /> 返回章节选择
        </Link>
      </div>

      <PointStudySection items={articleCards} />
      <PointDemosSection items={demoCards} />
      <PointCardsSection cards={cards} />
      {/* 懒加载接口 /api/exam/408/point-questions 仍以库内主键校验，这里显式传 internal key；
          展示层链接已由各组件统一走 yuanabd-408 前缀（P7） */}
      <PointQuestionsSection questions={questions} pointKey={pointKey} />

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">来源</p>
          <p>{detail.source.name}（{detail.source.baseUrl}）。{detail.source.licenseNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}