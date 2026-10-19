"use client";

import { useCallback, useEffect, useState } from "react";
import type { LearningReviewCard, LearningReviewResponse } from "@learn-workbench/shared/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock3, Pause, Play, RotateCcw } from "lucide-react";

const STATUS_LABEL: Record<LearningReviewCard["status"], string> = {
  learning: "学习中",
  review: "待复习",
  mastered: "已掌握",
  suspended: "已暂停",
};

function clientId(action: string): string {
  return `web-review-${action}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function snoozeUntil(): string {
  return new Date(Date.now() + 86_400_000).toISOString();
}

export function ReviewPlan({ trackSlug }: { trackSlug: string }) {
  const [review, setReview] = useState<LearningReviewResponse | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/learning/review?scope=all`);
      if (!response.ok) return;
      const data = (await response.json()) as LearningReviewResponse;
      setReview({
        ...data,
        cards: data.cards.filter((card) => card.trackSlug === trackSlug),
      });
    } catch {
      setReview(null);
    }
  }, [trackSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load settles after the effect returns
    void load();
  }, [load]);

  const act = async (
    card: LearningReviewCard,
    action: "snooze" | "pause" | "resume" | "complete"
  ) => {
    setBusy(`${card.questionKey}:${action}`);
    setNotice("");
    try {
      const response = await fetch("/api/learning/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          questionKeys: [card.questionKey],
          clientId: clientId(action),
          ...(action === "snooze"
            ? {
                snoozeDays: 1,
                snoozeUntil: snoozeUntil(),
              }
            : {}),
        }),
      });
      if (!response.ok) throw new Error("review action failed");
      await load();
    } catch {
      setNotice("操作失败，请稍后重试。");
    } finally {
      setBusy("");
    }
  };

  if (!review) return null;
  if (review.cards.length === 0) return null;

  const due = review.cards.filter(
    (card) =>
      card.status !== "mastered" &&
      card.status !== "suspended" &&
      Date.parse(card.dueAt) <= Date.parse(review.generatedAt)
  );
  const weak = review.cards
    .filter((card) => card.topicKey && (card.lastResult === false || card.lapses > 0))
    .slice(0, 4);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">复习计划</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              到期 {due.length} 题 · 暂停 {review.cards.filter((card) => card.status === "suspended").length} 题
              · 已掌握 {review.cards.filter((card) => card.status === "mastered").length} 题
            </p>
          </div>
          {weak.length > 0 ? <Badge variant="muted">薄弱知识点 {weak.length}</Badge> : null}
        </div>

        {notice ? <p className="text-xs text-danger">{notice}</p> : null}

        <ul className="flex flex-col gap-2">
          {review.cards.slice(0, 10).map((card) => (
            <li
              key={card.questionKey}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{card.questionKey}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {STATUS_LABEL[card.status]} · 下次 {new Date(card.dueAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {card.status === "suspended" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === `${card.questionKey}:resume`}
                    onClick={() => void act(card, "resume")}
                  >
                    <Play /> 恢复
                  </Button>
                ) : card.status !== "mastered" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy === `${card.questionKey}:snooze`}
                      onClick={() => void act(card, "snooze")}
                    >
                      <Clock3 /> 延后
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === `${card.questionKey}:pause`}
                      onClick={() => void act(card, "pause")}
                    >
                      <Pause /> 暂停
                    </Button>
                    <Button
                      size="sm"
                      loading={busy === `${card.questionKey}:complete`}
                      onClick={() => void act(card, "complete")}
                    >
                      <CheckCircle2 /> 完成
                    </Button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-success-strong">
                    <RotateCcw className="size-3.5" /> 已完成
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
