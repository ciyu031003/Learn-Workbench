"use client";

import { use, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import {
  QUALITY_LEVEL_LABEL,
  getLearningTrack,
  isLearnable,
  isReviewed,
  knowledgePointKeyOf,
  qualityOfTopic,
  type LearningStage,
  type LearningTopic,
  type LearningTrack,
} from "@learn-workbench/content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LearningMastery } from "@/components/learning/mastery-badge";
import { ReviewPlan } from "@/components/learning/review-plan";
import { CodeCopyButton, FavoriteMark, ReadBadge, useLibraryState } from "@/components/learning/library-state";
import { FreshnessBadge, PointStateSummary, StateDots, useContentFreshness, usePointStates } from "@/components/learning/point-states";
import { AlgorithmAnimation } from "@/components/learning/algorithm-animation";
import type { PointStateResult } from "@/lib/learning-states";
import { LEARNING_DIFFICULTY_LABEL, stageStats, topicQuestions, trackStats } from "@/lib/learning-stats";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, ListChecks, Sparkles, TriangleAlert, Wrench } from "lucide-react";

/**
 * 深链 hash 订阅（useSyncExternalStore 的 subscribe/getSnapshot）。
 * 只监听 hashchange：同页内换深链、浏览器前进后退都能拿到，且不触发任何 setState。
 */
function subscribeHash(onHashChange: () => void): () => void {
  window.addEventListener("hashchange", onHashChange);
  return () => window.removeEventListener("hashchange", onHashChange);
}

function readHash(): string {
  return typeof window === "undefined" ? "" : window.location.hash;
}

/** 服务端没有 hash：返回 ""，客户端水合时由 React 校验一致性 */
function readHashServer(): string {
  return "";
}

/** 滚到某个知识点：等展开动画/重排完成再滚，否则目标位置还是折叠时的高度（纯 DOM 副作用，无 setState） */
function scrollToTopic(topicKey: string): void {
  const behavior: ScrollBehavior =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  setTimeout(() => {
    document.getElementById(`kp-${topicKey}`)?.scrollIntoView({ behavior, block: "start" });
  }, 60);
}

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const track = getLearningTrack(slug);
  const library = useLibraryState(track?.slug);
  // 阶段 13/14：知识点五状态 + 内容时效
  const pointStates = usePointStates(track?.slug);
  const staleKeys = useContentFreshness(track?.slug);
  /**
   * 深链：#kp-<topicKey> 由题库「回知识点」与分享链接带上。
   * 用 useSyncExternalStore 订阅 hash（而不是 useEffect + 同步 setState）：
   * effect 体内同步 setState 会级联渲染（react-hooks/set-state-in-effect）；订阅还顺带
   * 支持"同页内 hash 变化"，这是原先只在挂载时读一次 window.location.hash 做不到的。
   * 服务端快照返回 ""，客户端返回真实 hash —— 由 React 做水合一致性校验。
   */
  const hash = useSyncExternalStore(subscribeHash, readHash, readHashServer);
  const deepLinkTopic = useMemo(() => {
    if (!track || !hash.startsWith("#kp-")) return null;
    try {
      return decodeURIComponent(hash.slice(4));
    } catch {
      return null; // hash 里的 % 不合法：当作没有深链，不要让整页崩掉
    }
  }, [track, hash]);
  const deepLinkStageKey = useMemo(
    () =>
      deepLinkTopic
        ? track?.stages.find((stage) => stage.topics.some((topic) => topic.key === deepLinkTopic))?.key ?? null
        : null,
    [track, deepLinkTopic]
  );

  /**
   * 阶段展开状态：**显式记录用户的展开/收起**（没有记录就走默认值）。
   * 默认 = 首个阶段展开；深链 #kp-<topicKey> 指向的阶段额外展开。
   * 这样深链的展开是"渲染期派生"而不是 effect 里同步 setState —— 后者会触发级联渲染
   * （react-hooks/set-state-in-effect），且用户手动收起深链阶段后还会被 effect 反复顶开。
   */
  const [stageToggles, setStageToggles] = useState<Record<string, boolean>>({});
  const isStageOpen = useCallback(
    (stageKey: string, index: number) => stageToggles[stageKey] ?? (index === 0 || stageKey === deepLinkStageKey),
    [stageToggles, deepLinkStageKey]
  );
  /** 课程内扁平顺序：上一节/下一节跨阶段自动落到相邻端点（与移动端阅读页同一套口径） */
  const flatTopics = useMemo(
    () =>
      track
        ? track.stages.flatMap((stage) =>
            stage.topics
              // 阶段 9 门槛：L0/L1（占位/仅摘要）不进正式学习列表
              .filter((topic) => isLearnable(qualityOfTopic(track, stage, topic).level))
              .map((topic) => ({ stageKey: stage.key, topicKey: topic.key, title: topic.title }))
          )
        : [],
    [track]
  );
  /** 目录/上一节下一节点击：**事件驱动**的 setState（effect 里不再同步 setState），再滚动过去 */
  const openAndScroll = useCallback((stageKey: string, topicKey: string) => {
    setStageToggles((current) => (current[stageKey] ? current : { ...current, [stageKey]: true }));
    scrollToTopic(topicKey);
  }, []);

  /**
   * 深链：#kp-<topicKey> 由题库「回知识点」与分享链接带上。
   * 展开已由 isStageOpen 从 deepLinkStageKey 派生，effect 只做"滚动过去"这一个 DOM 副作用
   * （不调用 openAndScroll —— 它含 setState，在 effect 同步路径里会级联渲染）。
   */
  useEffect(() => {
    if (!deepLinkTopic) return;
    scrollToTopic(deepLinkTopic);
  }, [deepLinkTopic]);

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
          {pointStates.status === "ready" ? <PointStateSummary points={pointStates.points} /> : null}
        </CardContent>
      </Card>

      <ReviewPlan trackSlug={track.slug} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">课程大纲</h2>
        <span className="text-xs text-muted-foreground">
          {library.status === "ready"
            ? `已读 ${library.counts.read} 节 · 收藏 ${library.counts.favorites} 节`
            : "点击目录定位知识点，展开阶段查看详情"}
        </span>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-20 lg:w-72 lg:shrink-0">
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <h3 className="text-xs font-semibold text-muted-foreground">课程目录</h3>
              <ol className="flex flex-col gap-2 text-sm">
                {track.stages.map((stage, index) => (
                  <li key={stage.key} className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => openAndScroll(stage.key, stage.topics[0]?.key ?? "")}
                      className="flex items-start gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="mt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-foreground">{stage.title}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {stage.topics.length} 知识点
                        </span>
                      </span>
                    </button>
                    <ul className="flex flex-col gap-0.5 pl-6">
                      {stage.topics.filter((topic) => isLearnable(qualityOfTopic(track, stage, topic).level)).map((topic) => {
                        const pointKey = knowledgePointKeyOf({
                          trackSlug: track.slug,
                          stageKey: stage.key,
                          topicKey: topic.key,
                        });
                        return (
                          <li key={topic.key}>
                            <button
                              type="button"
                              onClick={() => openAndScroll(stage.key, topic.key)}
                              className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                            >
                              <span className="min-w-0 flex-1 truncate">{topic.title}</span>
                              {library.favorites.has(pointKey) ? <FavoriteMark /> : null}
                              <ReadBadge progress={library.read.get(pointKey)} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {track.stages.map((stage, index) => {
            const scoped = stageStats(track, stage.key);
            const open = isStageOpen(stage.key, index);
            return (
              <details
                key={stage.key}
                open={open}
                onToggle={(event) => {
                  // <details> 的原生展开/收起：把用户意图记进 stageToggles（事件驱动，非 effect）
                  const isOpen = event.currentTarget.open;
                  setStageToggles((current) => (current[stage.key] === isOpen ? current : { ...current, [stage.key]: isOpen }));
                }}
                className="group rounded-xl border border-border/60 bg-card/60"
              >
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
                    {stage.topics
                      .filter((topic) => isLearnable(qualityOfTopic(track, stage, topic).level))
                      .map((topic, topicIndex) => {
                      const flatIndex = flatTopics.findIndex(
                        (entry) => entry.stageKey === stage.key && entry.topicKey === topic.key
                      );
                      const kpKey = knowledgePointKeyOf({ trackSlug: track.slug, stageKey: stage.key, topicKey: topic.key });
                      return (
                        <li key={topic.key} id={`kp-${topic.key}`} className="scroll-mt-24">
                          <TopicCard
                            track={track}
                            topic={topic}
                            index={topicIndex}
                            stage={stage}
                            stageKey={stage.key}
                            library={library}
                            pointState={pointStates.points[kpKey]}
                            stale={staleKeys.has(kpKey)}
                            previous={flatIndex > 0 ? flatTopics[flatIndex - 1] : null}
                            next={flatIndex >= 0 && flatIndex < flatTopics.length - 1 ? flatTopics[flatIndex + 1] : null}
                            onNavigate={openAndScroll}
                          />
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </details>
            );
          })}
        </div>
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

interface FlatTopic {
  stageKey: string;
  topicKey: string;
  title: string;
}

function TopicCard({
  track,
  topic,
  index,
  stage,
  stageKey,
  library,
  pointState,
  stale,
  previous,
  next,
  onNavigate,
}: {
  track: LearningTrack;
  topic: LearningTopic;
  index: number;
  stage: LearningStage;
  stageKey: string;
  library: { read: Map<string, number>; favorites: Set<string> };
  pointState?: PointStateResult;
  stale: boolean;
  previous: FlatTopic | null;
  next: FlatTopic | null;
  onNavigate: (stageKey: string, topicKey: string) => void;
}) {
  const questions = topicQuestions(track, topic.key);
  const pointKey = knowledgePointKeyOf({ trackSlug: track.slug, stageKey, topicKey: topic.key });
  const quality = qualityOfTopic(track, stage, topic);
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
        {library.favorites.has(pointKey) ? <FavoriteMark /> : null}
        <StateDots state={pointState} />
        <FreshnessBadge stale={stale} />
        <QualityBadge level={quality.level} />
        <ReadBadge progress={library.read.get(pointKey)} />
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
              <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-1">
                <p className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
                  {topic.lesson.example.title} · {topic.lesson.example.language}
                </p>
                <CodeCopyButton code={topic.lesson.example.code} />
              </div>
              <pre className="overflow-x-auto p-3">
                <code className="font-mono text-xs leading-relaxed">{topic.lesson.example.code}</code>
              </pre>
              <p className="px-3 pb-3 text-xs text-muted-foreground">{topic.lesson.example.explanation}</p>
            </div>
            <Block title="练习路径" items={topic.lesson.practiceSteps} />
          </>
        ) : null}

        {topic.animations?.length ? <AlgorithmAnimation keys={topic.animations} /> : null}

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">答案与解析在 App 内作答时给出，作答会写入掌握度与复习队列。</p>
            {/* 双向关联：知识点页 → 题库（按本题知识点过滤） */}
            <Link
              href={`/learn/questions?track=${track.slug}&topic=${topic.key}`}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              在题库中练习本节 <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* 上一节 / 下一节：跨阶段自动落到相邻端点，与移动端阅读页口径一致 */}
        <nav className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
          {previous ? (
            <button
              type="button"
              onClick={() => onNavigate(previous.stageKey, previous.topicKey)}
              className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">上一节 · {previous.title}</span>
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">本课程第一节</span>
          )}
          {next ? (
            <button
              type="button"
              onClick={() => onNavigate(next.stageKey, next.topicKey)}
              className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="min-w-0 truncate">下一节 · {next.title}</span>
              <ChevronRight className="size-3.5 shrink-0" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">本课程最后一节</span>
          )}
        </nav>
      </div>
    </details>
  );
}

/** 内容质量分级角标（阶段 9）：L4 = 已审核；L2/L3 = 待补充（L0/L1 不会出现在列表里） */
function QualityBadge({ level }: { level: keyof typeof QUALITY_LEVEL_LABEL }) {
  const reviewed = isReviewed(level);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        reviewed ? "bg-success/10 text-success-strong" : "bg-warning/10 text-warning"
      }`}
      title={QUALITY_LEVEL_LABEL[level]}
    >
      {QUALITY_LEVEL_LABEL[level]}
    </span>
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
