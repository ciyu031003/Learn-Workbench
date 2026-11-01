import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  ChevronDown,
  Clock,
  Film,
  ListChecks,
  NotebookPen,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExamQuestionCard } from "@/components/exam/exam-question-card";
import type { Exam408Question } from "@/lib/exam-408";
import type { Exam408CardContent } from "@/lib/exam-408-cards";
import type { Exam408DemoSummary } from "@/lib/exam-408-demos";
import {
  studyImportanceMeta,
  studyTopicHref,
  type StudyTopicSummary,
} from "@/lib/exam-408-study";
import { cn } from "@/lib/utils";

/**
 * 知识点聚合页的四类资源区块（v1.55 / P3 收口）。
 *
 * 背景：知识点详情页过去只有「摘要 + 正文 + 真题列表」，把 cs408 精读、408card 速记卡
 * 与逐帧演示三套内容都藏在各自的目录里。迁移 085-087 + map-points 已把四类资源挂到
 * knowledge_point_key，本文件负责把它们渲染成可读、可跳转、不会把页面拉爆长的区块。
 *
 * 全是服务端组件（无 "use client"）：
 * - 折叠统一用原生 details/summary，零 JS 依赖、首屏即可交互、无 hydrated 差异；
 * - 速记卡/真题按需展开，避免一个知识点 13 道大题直接把页面拉成一屏 8000px；
 * - 空资源直接返回 null，由页面自然收口，不出现空占位。
 */

export interface PointResourceCounts {
  articles: number;
  cards: number;
  demos: number;
  questions: number;
}

export interface PointArticleCard {
  article: StudyTopicSummary;
  excerpt: string;
}

export interface PointDemoCard {
  demo: Exam408DemoSummary;
  /** 首帧缩略图（/content-demos/<demo>/<n>.webp）；抓取未完成时为 null */
  frame: string | null;
}

/* ------------------------------------------------------------------ */
/* 四类资源数量概览                                                    */
/* ------------------------------------------------------------------ */

const OVERVIEW_ITEMS: Array<{
  key: keyof PointResourceCounts;
  label: string;
  href: string;
  icon: ReactNode;
  tone: string;
}> = [
  { key: "articles", label: "精读文章", href: "#point-articles", icon: <BookOpenText className="size-4" />, tone: "bg-primary/10 text-primary" },
  { key: "demos", label: "交互演示", href: "#point-demos", icon: <Film className="size-4" />, tone: "bg-accent/12 text-accent-strong" },
  { key: "cards", label: "速记卡", href: "#point-cards", icon: <NotebookPen className="size-4" />, tone: "bg-success/12 text-success-strong" },
  { key: "questions", label: "历年真题", href: "#point-questions", icon: <ListChecks className="size-4" />, tone: "bg-primary/10 text-primary" },
];

/**
 * 「本点四类资源」概览：右侧/顶部一排小卡，点击直达对应区块。
 * 数量为 0 的类别不渲染（用户看不到空区块的入口）。
 */
export function PointResourceOverview({ counts }: { counts: PointResourceCounts }) {
  const visible = OVERVIEW_ITEMS.filter((item) => counts[item.key] > 0);
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {visible.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/70 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <span className={cn("flex size-8 items-center justify-center rounded-lg", item.tone)}>{item.icon}</span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold leading-none tabular-nums">{counts[item.key]}</span>
            <span className="mt-1 block truncate text-[11px] text-muted-foreground">{item.label}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 区块通用件                                                          */
/* ------------------------------------------------------------------ */

function SectionShell({
  id,
  icon,
  title,
  meta,
  hint,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  meta: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="muted">{meta}</Badge>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function importanceBadgeVariant(tone: string): "default" | "warning" | "muted" | "success" {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "muted") return "muted";
  return "default";
}

/* ------------------------------------------------------------------ */
/* ② 精读文章                                                          */
/* ------------------------------------------------------------------ */

export function PointStudySection({ items }: { items: PointArticleCard[] }) {
  if (items.length === 0) return null;
  return (
    <SectionShell
      id="point-articles"
      icon={<BookOpenText className="size-4" />}
      title="精读"
      meta={items.length + " 篇"}
      hint="cs408 原文长读 · 按章节顺序读全文"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ article, excerpt }) => {
          const importance = studyImportanceMeta(article.importance);
          return (
            <Link key={article.slug} href={studyTopicHref(article.slug)} className="group block">
              <Card className="flex h-full flex-col gap-2 p-4 transition-colors group-hover:border-primary/30">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline">{article.chapter}</Badge>
                  <Badge variant={importanceBadgeVariant(importance.tone)}>{importance.label}</Badge>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {article.readingMinutes} 分钟
                  </span>
                  {article.examFrequency > 0 ? <span>· 真题命中 {article.examFrequency} 次</span> : null}
                </div>
                <h3 className="text-[15px] font-semibold leading-snug">{article.title}</h3>
                {excerpt ? (
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{excerpt}</p>
                ) : null}
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary">
                  阅读精读 <ArrowRight className="size-3.5" />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* ③ 交互演示                                                          */
/* ------------------------------------------------------------------ */

export function PointDemosSection({ items }: { items: PointDemoCard[] }) {
  if (items.length === 0) return null;
  return (
    <SectionShell
      id="point-demos"
      icon={<Film className="size-4" />}
      title="演示"
      meta={items.length + " 个"}
      hint="逐帧动图 · 点开逐步播放"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ demo, frame }) => (
          <Link
            key={demo.key}
            href={"/learn/408/viz/" + encodeURIComponent(demo.key)}
            className="group block"
          >
            <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-primary/30">
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                {frame ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 帧是静态 webp 镜像，next/image 无法离线优化
                  <img
                    src={frame}
                    alt={demo.title + " 首帧"}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 text-primary/70">
                    <Film className="size-7" />
                    <span className="text-[11px]">首帧待抓取</span>
                  </div>
                )}
                <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
                  {demo.stepsCount} 步 · {demo.frameCount} 帧
                </span>
              </div>
              <div className="flex flex-col gap-1 p-4">
                <h3 className="text-[15px] font-semibold leading-snug">{demo.title}</h3>
                {demo.description ? (
                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{demo.description}</p>
                ) : null}
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary">
                  播放演示 <ArrowRight className="size-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* ④ 速记卡（折叠）                                                     */
/* ------------------------------------------------------------------ */

export function PointCardsSection({ cards }: { cards: Exam408CardContent[] }) {
  if (cards.length === 0) return null;
  return (
    <SectionShell
      id="point-cards"
      icon={<NotebookPen className="size-4" />}
      title="速记卡"
      meta={cards.length + " 张"}
      hint="点开看答案 / 易错 / 口诀"
    >
      <div className="flex flex-col gap-2">
        {cards.map((card, index) => (
          <details key={card.key} className="group rounded-xl border border-border bg-surface/70 px-4 py-3 open:bg-surface">
            <summary className="flex cursor-pointer list-none items-start gap-2.5 [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-success/12 text-[11px] font-semibold tabular-nums text-success-strong">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-1.5 text-sm font-medium leading-6 text-foreground">
                  {card.star ? <Star className="mt-1 size-3.5 shrink-0 fill-warning text-warning" /> : null}
                  <span>{card.question}</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {card.answerSteps.length > 0 ? card.answerSteps.length + " 步答案" : "答案暂缺"}
                  {card.pitfall ? " · 含易错点" : ""}
                  {card.mnemonic ? " · 含口诀" : ""}
                </span>
              </span>
              <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3">
              {card.answerSteps.length > 0 ? (
                <ol className="flex flex-col gap-1.5">
                  {card.answerSteps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex gap-2 text-sm leading-6 text-foreground/90">
                      <span className="mt-0.5 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {stepIndex + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">该卡暂无分步答案。</p>
              )}
              {card.pitfall ? (
                <div className="flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm leading-6 text-warning-strong">
                  <AlertTriangle className="mt-1 size-4 shrink-0" />
                  <span>
                    <span className="font-semibold">易错：</span>
                    {card.pitfall}
                  </span>
                </div>
              ) : null}
              {card.mnemonic ? (
                <div className="flex gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm leading-6 text-accent-strong">
                  <Sparkles className="mt-1 size-4 shrink-0" />
                  <span>
                    <span className="font-semibold">口诀：</span>
                    {card.mnemonic}
                  </span>
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* ⑤ 真题（分年份 + 默认折叠）                                          */
/* ------------------------------------------------------------------ */

export interface PointQuestionYearGroup {
  year: number;
  questions: Exam408Question[];
  totalPoints: number;
}

/** 按年份分组：年份倒序（最新在前），同一年按题号升序；无年份的归入最后一组 */
export function groupPointQuestionsByYear(questions: Exam408Question[]): PointQuestionYearGroup[] {
  const groups = new Map<number, Exam408Question[]>();
  for (const question of questions) {
    const year = Number(question.year) || 0;
    const bucket = groups.get(year) ?? [];
    bucket.push(question);
    groups.set(year, bucket);
  }
  return [...groups.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([year, items]) => ({
      year,
      questions: [...items].sort((left, right) => left.number - right.number),
      totalPoints: items.reduce((sum, question) => sum + (Number(question.points) || 0), 0),
    }));
}

export function PointQuestionsSection({ questions }: { questions: Exam408Question[] }) {
  const groups = groupPointQuestionsByYear(questions);
  return (
    <SectionShell
      id="point-questions"
      icon={<ListChecks className="size-4" />}
      title="关联真题"
      meta={questions.length + " 题"}
      hint={groups.length > 1 ? "按年份折叠 · 展开后看题干与解析" : "点开看题干与解析"}
    >
      {questions.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">该知识点暂无关联真题，可先读上面的精读与速记卡。</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group, groupIndex) => (
            <details
              key={group.year || "unknown"}
              className="group rounded-xl border border-border bg-surface/70"
              open={groupIndex === 0 && groups.length === 1}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ListChecks className="size-4" />
                </span>
                <span className="text-sm font-semibold">{group.year > 0 ? group.year + " 年" : "未标注年份"}</span>
                <Badge variant="muted">{group.questions.length} 题</Badge>
                <Badge variant="muted">{group.totalPoints} 分</Badge>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  展开
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-border p-4">
                {group.questions.map((question) => (
                  <ExamQuestionCard key={question.key} question={question} />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
