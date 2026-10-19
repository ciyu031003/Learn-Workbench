"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Exam408Question } from "@/lib/exam-408";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { cleanAnswerText, cleanExamStem } from "./question-utils";
import { QuestionImage } from "./question-image";

export function ExamQuestionCard({
  question,
  footer,
}: {
  question: Exam408Question;
  footer?: ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);
  const correct = new Set(
    (question.answerLetter ?? "")
      .split("")
      .map((letter) => letter.trim())
      .filter(Boolean),
  );
  const answerText = cleanAnswerText(question.answerText);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">第 {question.number} 题</span>
          <Badge variant="outline">{question.type === "choice" ? "选择题" : "综合应用题"}</Badge>
          <span>{question.points} 分</span>
          <span>·</span>
          <span>{question.subject.title}</span>
          {question.year ? (
            <>
              <span>·</span>
              <Link href={`/learn/408/papers/${question.year}`} className="font-medium text-primary hover:underline">
                {question.year} 年
              </Link>
            </>
          ) : null}
        </div>

        <div className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
          {cleanExamStem(question.stem)}
        </div>

        {question.imageRefs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {question.imageRefs.map((url) => (
              <QuestionImage
                key={url}
                src={url}
                alt={`第 ${question.number} 题配图`}
                className="max-h-80"
              />
            ))}
          </div>
        ) : null}

        {question.options.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {question.options.map((option) => {
              const isCorrect = revealed && correct.has(option.letter);
              return (
                <li
                  key={option.letter}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    isCorrect ? "border-success/40 bg-success/5" : "border-border/50"
                  }`}
                >
                  <span className="mt-0.5 font-mono text-xs font-semibold text-muted-foreground">{option.letter}</span>
                  <span className="min-w-0 flex-1 leading-relaxed">{option.text}</span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {revealed ? (
          <div className="rounded-lg border border-success/25 bg-success/5 px-3 py-3 text-sm">
            <p className="font-medium text-success-strong">
              参考答案：{question.answerLetter ?? question.answerText}
            </p>
            {answerText ? (
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-muted-foreground">{answerText}</p>
            ) : null}
            {question.answerImageRefs.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {question.answerImageRefs.map((url) => (
                  <QuestionImage
                    key={url}
                    src={url}
                    alt={`第 ${question.number} 题答案图`}
                    className="max-h-80"
                    wrapperClassName="border-border/50"
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {question.videoUrl ? (
          <a
            href={question.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <ExternalLink className="size-3.5" /> 打开原视频讲解
          </a>
        ) : null}

        {question.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {question.tags.slice(0, 8).map((tag) => (
              <Badge key={tag} variant="muted">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {revealed ? "收起答案" : "显示答案"}
          </button>
          {footer}
        </div>
      </CardContent>
    </Card>
  );
}
