"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  Bug,
  Flame,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";
import type {
  CardQueueScope,
  CardRating,
  Exam408CardQueue,
  Exam408CardStats,
  Exam408QueueCard,
} from "@/lib/exam-408-cards";

/**
 * 408 刷卡（Web）：翻卡 → 三档评级 → 会话统计。
 *
 * 职责边界：首屏卡组由服务端给（避免二次请求闪白），评级写库仍走
 * POST /api/exam/408/cards（幂等 + FSRS 推进在服务端），客户端只维护
 * 「翻面 / 下一张 / 本组计数」这类纯 UI 状态。
 */

const RATING_BUTTONS: Array<{
  rating: CardRating;
  label: string;
  hint: string;
  key: string;
  className: string;
  icon: typeof ThumbsUp;
}> = [
  {
    rating: "again",
    label: "不会",
    hint: "Again",
    key: "1",
    className: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15",
    icon: ThumbsDown,
  },
  {
    rating: "hard",
    label: "模糊",
    hint: "Hard",
    key: "2",
    className: "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
    icon: Target,
  },
  {
    rating: "good",
    label: "会",
    hint: "Good",
    key: "3",
    className: "border-success/40 bg-success/10 text-success hover:bg-success/15",
    icon: ThumbsUp,
  },
];

export interface CardSubjectOption {
  key: string;
  title: string;
}

function cardQuery(mode: "queue" | "stats", subject: string | null, scope: CardQueueScope): string {
  const params = new URLSearchParams({ mode });
  if (subject) params.set("subject", subject);
  if (mode === "queue" && scope === "mistake") params.set("scope", "mistake");
  return params.toString();
}

function drillHref(subject: string | null, scope: CardQueueScope): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (scope === "mistake") params.set("scope", "mistake");
  const query = params.toString();
  return query.length > 0 ? "/learn/408/drill?" + query : "/learn/408/drill";
}

export function CardDrill({
  initialQueue,
  initialStats,
  subject,
  scope,
  subjectOptions,
}: {
  initialQueue: Exam408CardQueue;
  initialStats: Exam408CardStats;
  subject: string | null;
  scope: CardQueueScope;
  subjectOptions: CardSubjectOption[];
}) {
  const [cards, setCards] = useState<Exam408QueueCard[]>(initialQueue.cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Exam408CardStats>(initialStats);
  const [doneToday, setDoneToday] = useState(initialQueue.stats.doneToday);
  const [remainingDue, setRemainingDue] = useState(initialQueue.stats.dueCount);
  const [session, setSession] = useState({
    graded: 0,
    correct: 0,
    again: 0,
    hard: 0,
    good: 0,
  });
  const clientIdSeq = useRef(0);

  const current = cards[index] ?? null;
  const total = cards.length;
  const empty = total === 0;
  const finished = total > 0 && index >= total;
  const percent = total === 0 ? 0 : Math.round((Math.min(index, total) / total) * 100);

  const refreshStats = useCallback(async () => {
    try {
      const response = await fetch("/api/exam/408/cards?" + cardQuery("stats", subject, scope), {
        cache: "no-store",
      });
      if (!response.ok) return;
      setStats((await response.json()) as Exam408CardStats);
    } catch {
      // 统计刷新失败不影响刷卡主流程，下次进页面会重算
    }
  }, [scope, subject]);

  const reload = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/exam/408/cards?" + cardQuery("queue", subject, scope), {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("队列加载失败（" + response.status + "）");
      const payload = (await response.json()) as Exam408CardQueue;
      setCards(payload.cards);
      setIndex(0);
      setFlipped(false);
      setDoneToday(payload.stats.doneToday);
      setRemainingDue(payload.stats.dueCount);
      setSession({ graded: 0, correct: 0, again: 0, hard: 0, good: 0 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "队列加载失败");
    } finally {
      setPending(false);
    }
  }, [scope, subject]);

  const grade = useCallback(
    async (rating: CardRating) => {
      if (!current || pending) return;
      setPending(true);
      setError("");
      clientIdSeq.current += 1;
      const clientId = current.key + "-" + Date.now() + "-" + clientIdSeq.current;
      try {
        const response = await fetch("/api/exam/408/cards", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cardKey: current.key, rating, clientId }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; doneToday?: number; remainingDue?: number }
          | null;
        if (!response.ok) throw new Error(payload?.error ?? "评级失败（" + response.status + "）");
        if (typeof payload?.doneToday === "number") setDoneToday(payload.doneToday);
        if (typeof payload?.remainingDue === "number") setRemainingDue(payload.remainingDue);
        setSession((prev) => ({
          ...prev,
          graded: prev.graded + 1,
          correct: prev.correct + (rating === "again" ? 0 : 1),
          again: prev.again + (rating === "again" ? 1 : 0),
          hard: prev.hard + (rating === "hard" ? 1 : 0),
          good: prev.good + (rating === "good" ? 1 : 0),
        }));
        setFlipped(false);
        setIndex((prev) => prev + 1);
        // 最后一张：直接在这里拉一次统计（不用 effect，避免 setState-in-effect 的级联渲染）
        if (index + 1 >= total) void refreshStats();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "评级失败，请重试");
      } finally {
        setPending(false);
      }
    },
    [current, index, pending, refreshStats, total],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        if (pending || !current || flipped) return;
        event.preventDefault();
        setFlipped(true);
        return;
      }
      if (!flipped || pending || !current) return;
      const rating: CardRating | undefined =
        event.key === "1" ? "again" : event.key === "2" ? "hard" : event.key === "3" ? "good" : undefined;
      if (!rating) return;
      event.preventDefault();
      void grade(rating);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, flipped, grade, pending]);

  const sessionAccuracy = session.graded > 0 ? Math.round((session.correct / session.graded) * 100) : null;
  const subjectLabel = useMemo(
    () => subjectOptions.find((item) => item.key === subject)?.title ?? "四科混合",
    [subject, subjectOptions],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card rail="study">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="default">408 · 刷卡背诵</Badge>
                <Badge variant="outline">{subjectLabel}</Badge>
                {scope === "mistake" ? (
                  <Badge variant="muted">易错本</Badge>
                ) : null}
              </div>
              <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
                <BookOpenCheck className="size-5 text-primary" />
                {scope === "mistake" ? "易错卡重刷" : "先翻卡回忆，再给自己评级"}
              </h1>
            </div>
            <dl className="flex flex-wrap gap-2 text-center">
              <Stat label="今日已刷" value={doneToday} icon={<Sparkles className="size-3.5" />} />
              <Stat label="连续天数" value={stats.streak} icon={<Flame className="size-3.5" />} />
              <Stat label="剩余到期" value={remainingDue} icon={<Target className="size-3.5" />} />
            </dl>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">
                {total === 0 ? "本组已刷完" : "第 " + Math.min(index + 1, total) + " / " + total + " 张"}
              </span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {empty ? (
        <EmptyState
          icon={scope === "mistake" ? Bug : BookOpenCheck}
          title={scope === "mistake" ? "易错本还是空的" : "本组没有待刷的卡"}
          hint={
            scope === "mistake"
              ? "评过「不会」的卡会进易错本；先回队列正常刷一轮。"
              : "所有卡都排到期之后了。可以先看统计，或切到易错本重刷错题。"
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="sm">
                <Link href={drillHref(subject, scope === "mistake" ? "queue" : "mistake")}>
                  {scope === "mistake" ? "回刷卡队列" : "打开易错本"}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/learn/408">返回 408 专区</Link>
              </Button>
            </div>
          }
        />
      ) : finished ? (
        <CompletionPanel
          session={session}
          accuracy={sessionAccuracy}
          stats={stats}
          subjectOptions={subjectOptions}
          subject={subject}
          scope={scope}
          pending={pending}
          onReload={() => void reload()}
        />
      ) : current ? (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="muted">第 {current.chapter} 章</Badge>
                  {current.star ? <Badge variant="outline">重点</Badge> : null}
                  {current.lapses > 0 ? <Badge variant="outline">错过 {current.lapses} 次</Badge> : null}
                  {current.state === "due" ? <Badge variant="outline">复习</Badge> : null}
                  {current.state === "new" ? <Badge variant="outline">新卡</Badge> : null}
                  {current.state === "scheduled" ? <Badge variant="outline">未到期</Badge> : null}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {flipped ? "1 不会 · 2 模糊 · 3 会" : "空格 / 回车 翻面"}
                </span>
              </div>

              <p className="text-lg font-medium leading-8 sm:text-xl">
                <RichText text={current.question} />
              </p>

              {flipped ? (
                <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">答案要点</p>
                    {current.answerSteps.length > 0 ? (
                      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-7 text-foreground/90">
                        {current.answerSteps.map((step, stepIndex) => (
                          <li key={stepIndex}><RichText text={step} /></li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted-foreground">这张卡没有分步答案，按题干自己复述一遍即可。</p>
                    )}
                  </div>
                  {current.pitfall ? (
                    <p className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm leading-6 text-foreground/90">
                      <span className="font-medium text-danger">易错：</span>
                      <RichText text={current.pitfall} />
                    </p>
                  ) : null}
                  {current.mnemonic ? (
                    <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm leading-6 text-foreground/90">
                      <span className="font-medium text-primary">口诀：</span>
                      <RichText text={current.mnemonic} />
                    </p>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="fade-up rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  想好了就点这里翻面看答案
                </button>
              )}

              {flipped ? (
                <div className="grid grid-cols-3 gap-2">
                  {RATING_BUTTONS.map((item) => (
                    <button
                      key={item.rating}
                      type="button"
                      disabled={pending}
                      onClick={() => void grade(item.rating)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50",
                        item.className,
                      )}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                      <span className="text-[10px] font-normal opacity-70">{item.hint} · 按 {item.key}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {pending ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> 正在记录评级…
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">本组进度</p>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {session.graded} / {total}
                  </span>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">
                  不会 {session.again} · 模糊 {session.hard} · 会 {session.good} · 正确率{" "}
                  {sessionAccuracy === null ? "—" : sessionAccuracy + "%"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-sm font-medium">换一组 / 换科目</p>
                <div className="flex flex-wrap gap-1.5">
                  {subjectOptions.map((option) => (
                    <Link
                      key={option.key}
                      href={drillHref(option.key, scope)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                        option.key === subject
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-border/60 hover:border-primary/30",
                      )}
                    >
                      {option.title}
                    </Link>
                  ))}
                  <Link
                    href={drillHref(null, scope)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                      subject === null
                        ? "border-primary/35 bg-primary/10 text-primary"
                        : "border-border/60 hover:border-primary/30",
                    )}
                  >
                    四科混合
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href={drillHref(subject, scope === "mistake" ? "queue" : "mistake")}>
                      {scope === "mistake" ? "回刷卡队列" : "打开易错本"}
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void reload()} loading={pending}>
                    <RotateCcw className="size-3.5" /> 换一组
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <p className="px-1 text-[11px] leading-5 text-muted-foreground">
        卡面内容镜像自 408card.top，仅用于个人学习、不再分发；排程使用 FSRS（ts-fsrs）：不会=Again、模糊=Hard、会=Good。
        到期时间由服务端计算并写进复习卡，换设备登录后进度一致。
      </p>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="min-w-[76px] rounded-xl border border-border/60 bg-card/60 px-3 py-2">
      <dt className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CompletionPanel({
  session,
  accuracy,
  stats,
  subjectOptions,
  subject,
  scope,
  pending,
  onReload,
}: {
  session: { graded: number; correct: number; again: number; hard: number; good: number };
  accuracy: number | null;
  stats: Exam408CardStats;
  subjectOptions: CardSubjectOption[];
  subject: string | null;
  scope: CardQueueScope;
  pending: boolean;
  onReload: () => void;
}) {
  const subjectTitle = subjectOptions.find((item) => item.key === subject)?.title ?? "四科混合";
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-4 text-primary" /> 本组刷完了
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {subjectTitle} · 共 {session.graded} 张 · 正确率 {accuracy === null ? "—" : accuracy + "%"}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="今日已刷" value={stats.today.done} icon={<Sparkles className="size-3.5" />} />
          <Stat label="连续天数" value={stats.streak} icon={<Flame className="size-3.5" />} />
          <Stat label="剩余到期" value={stats.totals.dueCount} icon={<Target className="size-3.5" />} />
          <Stat label="新卡存量" value={stats.totals.newCount} icon={<Bug className="size-3.5" />} />
        </dl>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">四科进度</p>
          {stats.subjects.map((item) => {
            const done = item.cards - item.newCount;
            const progress = item.cards === 0 ? 0 : Math.round((done / item.cards) * 100);
            return (
              <div key={item.subjectKey} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground">{item.title}</span>
                <Progress value={progress} className="h-1.5" />
                <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
                  {done} / {item.cards}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onReload} loading={pending}>
            <RotateCcw className="size-4" /> 再来一组
          </Button>
          <Button asChild variant="outline">
            <Link href={scope === "mistake" ? drillHref(subject, "queue") : drillHref(subject, "mistake")}>
              {scope === "mistake" ? "回刷卡队列" : "打开易错本"}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/learn/408">返回 408 专区</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
