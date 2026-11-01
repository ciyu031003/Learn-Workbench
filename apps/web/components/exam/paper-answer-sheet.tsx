"use client";

import type { Exam408Question } from "@/lib/exam-408";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Send } from "lucide-react";

/** 试卷展示模式：exam = 一题一屏考试模式，review = 整卷速览复习模式。 */
export type PaperMode = "exam" | "review";

/** 单题作答结果，与既往 results 状态字段完全兼容。 */
export type AnswerResult = "correct" | "wrong" | "reviewed";

/** 答题卡上单题的四种状态：未答 / 答对 / 答错 / 已看参考答案（综合题）。 */
export type AnswerStatus = "unanswered" | AnswerResult;

export interface AnswerSheetEntry {
  number: number;
  type: Exam408Question["type"];
  points: number;
  status: AnswerStatus;
}

export interface AnswerSummary {
  total: number;
  answered: number;
  unanswered: number;
  correct: number;
  wrong: number;
  reviewed: number;
  /** 客观题得分：只统计答对的选择题分值。 */
  score: number;
  /** 正确率（0–100，按已判对错的选择题计算；没有已判题时为 0）。 */
  accuracy: number;
  /** 已判选择题数量（答对 + 答错），用于正确率分母。 */
  judged: number;
}

export interface ReviewFilter {
  type: "all" | Exam408Question["type"];
  year: "all" | number;
}

/** 把试卷题目与作答结果合并成答题卡条目：未作答的题自动补 unanswered。 */
export function buildAnswerSheet(
  questions: readonly Pick<Exam408Question, "number" | "type" | "points">[],
  results: Record<number, AnswerResult>,
): AnswerSheetEntry[] {
  return questions.map((question) => ({
    number: question.number,
    type: question.type,
    points: question.points,
    status: results[question.number] ?? "unanswered",
  }));
}

/** 汇总答题卡：题数统计、客观题得分、正确率，供侧栏与交卷面板共用。 */
export function summarizeAnswers(entries: readonly AnswerSheetEntry[]): AnswerSummary {
  const summary: AnswerSummary = {
    total: entries.length,
    answered: 0,
    unanswered: 0,
    correct: 0,
    wrong: 0,
    reviewed: 0,
    score: 0,
    accuracy: 0,
    judged: 0,
  };
  for (const entry of entries) {
    if (entry.status === "unanswered") {
      summary.unanswered += 1;
      continue;
    }
    summary.answered += 1;
    if (entry.status === "correct") {
      summary.correct += 1;
      summary.score += entry.points;
    } else if (entry.status === "wrong") {
      summary.wrong += 1;
    } else {
      summary.reviewed += 1;
    }
  }
  summary.judged = summary.correct + summary.wrong;
  summary.accuracy = summary.judged > 0 ? Math.round((summary.correct / summary.judged) * 100) : 0;
  return summary;
}

/** 把下标夹在 [0, total-1]，空卷统一返回 0。 */
export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  if (index < 0) return 0;
  if (index > total - 1) return total - 1;
  return index;
}

/** 按步长移动题号，越界时停在首题/末题（由调用方决定是否结算）。 */
export function stepIndex(index: number, total: number, delta: number): number {
  return clampIndex(index + delta, total);
}

export type KeyboardIntent =
  | { kind: "previous" }
  | { kind: "next" }
  | { kind: "select"; letter: string }
  | { kind: "submit" }
  | { kind: "none" };

/**
 * 键盘交互的纯函数映射：←/→ 切题、1–4 选选项、Enter 提交。
 * 已提交的题不再接受选项与重复提交；选项数量不足时数字键不生效。
 */
export function resolveKeyboardIntent(
  key: string,
  options: { optionLetters: readonly string[]; submitted: boolean },
): KeyboardIntent {
  if (key === "ArrowLeft") return { kind: "previous" };
  if (key === "ArrowRight") return { kind: "next" };
  if (key === "Enter") return options.submitted ? { kind: "none" } : { kind: "submit" };
  if (options.submitted) return { kind: "none" };
  if (!/^[1-9]$/.test(key)) return { kind: "none" };
  const letter = options.optionLetters[Number(key) - 1];
  return letter ? { kind: "select", letter } : { kind: "none" };
}

/** 整卷速览的题型/年份筛选（顺序与原卷一致，不重新排序）。 */
export function filterQuestions(
  questions: readonly Exam408Question[],
  filter: ReviewFilter,
): Exam408Question[] {
  return questions.filter((question) => {
    if (filter.type !== "all" && question.type !== filter.type) return false;
    if (filter.year !== "all" && question.year !== filter.year) return false;
    return true;
  });
}

/** 试卷涉及到的年份，去重后由新到旧，用于年份筛选下拉。 */
export function collectYears(questions: readonly Exam408Question[]): number[] {
  return [...new Set(questions.map((question) => question.year))].sort((a, b) => b - a);
}

const STATUS_STYLE: Record<AnswerStatus, string> = {
  unanswered: "border-border bg-card/60 text-muted-foreground hover:border-primary/35 hover:text-foreground",
  correct: "border-success/40 bg-success/12 text-success-strong",
  wrong: "border-danger/40 bg-danger/12 text-danger-strong",
  reviewed: "border-accent/40 bg-accent/12 text-accent-strong",
};

const STATUS_LABEL: Record<AnswerStatus, string> = {
  unanswered: "未作答",
  correct: "答对",
  wrong: "答错",
  reviewed: "已看答案",
};

/** 题号答题卡：同一份内容在桌面侧栏与移动端底部抽屉里复用。 */
export function PaperAnswerSheet({
  entries,
  current,
  summary,
  finished,
  onJump,
  onFinish,
  className,
}: {
  entries: readonly AnswerSheetEntry[];
  current: number;
  summary: AnswerSummary;
  finished: boolean;
  onJump: (number: number) => void;
  onFinish: () => void;
  className?: string;
}) {
  const progress = summary.total > 0 ? Math.round((summary.answered / summary.total) * 100) : 0;
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">答题卡</span>
          <Badge variant="outline">
            {summary.answered}/{summary.total}
          </Badge>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          已作答 {summary.answered} 题 · 未作答 {summary.unanswered} 题 · 进度 {progress}%
        </p>

        <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5" role="list" aria-label="题号答题卡">
          {entries.map((entry) => {
            const active = entry.number === current;
            return (
              <button
                key={entry.number}
                type="button"
                role="listitem"
                aria-current={active ? "true" : undefined}
                aria-label={`第 ${entry.number} 题，${STATUS_LABEL[entry.status]}`}
                title={`第 ${entry.number} 题 · ${STATUS_LABEL[entry.status]}`}
                onClick={() => onJump(entry.number)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors",
                  STATUS_STYLE[entry.status],
                  active && "ring-2 ring-primary/35 ring-offset-1 ring-offset-background",
                )}
              >
                {entry.number}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <i className="size-2 rounded-full bg-success" aria-hidden /> 答对 {summary.correct}
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2 rounded-full bg-danger" aria-hidden /> 答错 {summary.wrong}
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2 rounded-full bg-accent" aria-hidden /> 已看答案 {summary.reviewed}
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2 rounded-full bg-muted-foreground/40" aria-hidden /> 未作答 {summary.unanswered}
          </span>
        </div>

        <dl className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted/40 px-2 py-2 text-center">
          <div>
            <dt className="text-[10px] text-muted-foreground">客观题得分</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{summary.score}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">正确率</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{summary.accuracy}%</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">已判题</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{summary.judged}</dd>
          </div>
        </dl>

        {finished ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-primary/8 px-2 py-1.5 text-[11px] text-primary-strong">
            <Check className="size-3.5" aria-hidden /> 本轮已交卷，可继续回看任意题
          </p>
        ) : (
          <Button size="sm" onClick={onFinish} className="w-full">
            <Send className="size-4" aria-hidden /> 交卷并统计
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
