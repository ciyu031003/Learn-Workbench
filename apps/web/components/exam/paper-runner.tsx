"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Exam408Paper, Exam408Question } from "@/lib/exam-408";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Eye,
  FileText,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { ExamQuestionCard } from "./exam-question-card";
import { cleanAnswerText, cleanExamStem } from "./question-utils";

type PaperMode = "practice" | "review";
type ResultKind = "correct" | "wrong" | "reviewed";

export function PaperRunner({ paper }: { paper: Exam408Paper }) {
  const [mode, setMode] = useState<PaperMode>("practice");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Record<number, ResultKind>>({});
  const question = paper.questions[index];
  const choiceCount = paper.questions.filter((item) => item.type === "choice").length;
  const comprehensiveCount = paper.questions.length - choiceCount;
  const answeredCount = Object.keys(results).length;

  const score = useMemo(() => {
    let total = 0;
    for (const item of paper.questions) {
      if (results[item.number] === "correct") total += item.points;
    }
    return total;
  }, [paper.questions, results]);

  const goToNumber = (number: number) => {
    const nextIndex = paper.questions.findIndex((item) => item.number === number);
    if (nextIndex < 0) return;
    setIndex(nextIndex);
    setSelected("");
    setSubmitted(false);
    setFinished(false);
  };

  const submit = () => {
    if (!question || submitted) return;
    if (question.type === "choice" && !selected) return;
    const result: ResultKind =
      question.type === "comprehensive"
        ? "reviewed"
        : selected === question.answerLetter
          ? "correct"
          : "wrong";
    setResults((current) => ({ ...current, [question.number]: result }));
    setSubmitted(true);
  };

  const next = () => {
    if (index >= paper.questions.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected("");
    setSubmitted(false);
  };

  const previous = () => {
    if (index <= 0) return;
    setIndex((value) => value - 1);
    setSelected("");
    setSubmitted(false);
    setFinished(false);
  };

  const restart = () => {
    setIndex(0);
    setSelected("");
    setSubmitted(false);
    setFinished(false);
    setResults({});
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-7">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">技术课程</Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">408 考研专项</Link>
        <span>/</span>
        <span className="text-foreground">{paper.paper.year} 年真题</span>
      </nav>

      <Card rail="study">
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="default">{paper.paper.year} 年 · 全国统考</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{paper.paper.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {paper.questions.length} 道原题 · 满分 {paper.paper.totalScore} 分 · 保留原卷题号与题型顺序
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={mode === "practice" ? "default" : "secondary"} size="sm" onClick={() => setMode("practice")}>
                顺序刷题
              </Button>
              <Button variant={mode === "review" ? "default" : "secondary"} size="sm" onClick={() => setMode("review")}>
                整卷速览
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="选择题" value={`${choiceCount} 题`} />
            <Metric label="综合应用题" value={`${comprehensiveCount} 题`} />
            <Metric label="试卷结构" value={`${paper.sections.length} 部分`} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {paper.sections.map((section) => (
            <button
              key={`${section.type}-${section.from}`}
              type="button"
              onClick={() => {
                setMode("practice");
                goToNumber(section.from);
              }}
              className="rounded-lg border border-border/60 px-3 py-2 text-left text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <span className="block font-semibold text-foreground">{section.title}</span>
              <span className="mt-0.5 block text-muted-foreground">
                第 {section.from}–{section.to} 题 · {section.totalScore} 分
              </span>
            </button>
          ))}
        </div>
      </div>

      {mode === "practice" ? (
        finished ? (
          <FinishPanel
            paper={paper}
            results={results}
            score={score}
            onRestart={restart}
            onReview={() => setMode("review")}
            onJump={goToNumber}
          />
        ) : question ? (
          <PracticeQuestion
            paper={paper}
            question={question}
            index={index}
            selected={selected}
            submitted={submitted}
            result={results[question.number]}
            onSelect={(letter) => {
              if (!submitted) setSelected(letter);
            }}
            onSubmit={submit}
            onPrevious={previous}
            onNext={next}
            onJump={goToNumber}
          />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">这套试卷暂时没有可用题目。</CardContent>
          </Card>
        )
      ) : (
        <ReviewPaper paper={paper} />
      )}

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">内容来源与使用边界</p>
          <p>
            来源：{paper.source.name}（{paper.source.baseUrl}）。{paper.source.licenseNote}
          </p>
          <p>
            页面保留原题号、题型、分值与图片；题目图片已本地化，视频讲解仍打开原站。
            {answeredCount > 0 ? `本轮已作答 ${answeredCount} 题。` : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PracticeQuestion({
  paper,
  question,
  index,
  selected,
  submitted,
  result,
  onSelect,
  onSubmit,
  onPrevious,
  onNext,
  onJump,
}: {
  paper: Exam408Paper;
  question: Exam408Question;
  index: number;
  selected: string;
  submitted: boolean;
  result?: ResultKind;
  onSelect: (letter: string) => void;
  onSubmit: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onJump: (number: number) => void;
}) {
  const progress = Math.round(((index + 1) / paper.questions.length) * 100);
  const isCorrect = question.type === "choice" && result === "correct";

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              第 {question.number} 题
            </span>
            <Badge variant="outline">{question.type === "choice" ? "选择题" : "综合应用题"}</Badge>
            <span>{question.points} 分</span>
            <span>·</span>
            <span>{question.subject.title}</span>
          </div>
          <TextQuestionNav paper={paper} current={question.number} onJump={onJump} />
        </div>

        <div className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
          {cleanExamStem(question.stem)}
        </div>

        <QuestionImages question={question} />

        {question.options.length > 0 ? (
          <div className="grid gap-2">
            {question.options.map((option) => {
              const active = selected === option.letter;
              const correct = submitted && question.answerLetter === option.letter;
              const wrong = submitted && active && question.answerLetter !== option.letter;
              return (
                <button
                  key={option.letter}
                  type="button"
                  disabled={submitted}
                  onClick={() => onSelect(option.letter)}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    correct
                      ? "border-success/50 bg-success/10"
                      : wrong
                        ? "border-danger/50 bg-danger/10"
                        : active
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/60 bg-card/50 hover:border-primary/30"
                  }`}
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-xs font-semibold">
                    {option.letter}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-6">{option.text}</span>
                  {correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : null}
                  {wrong ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {submitted ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              question.type === "choice"
                ? isCorrect
                  ? "border-success/30 bg-success/5"
                  : "border-danger/30 bg-danger/5"
                : "border-primary/25 bg-primary/5"
            }`}
          >
            <p className="font-semibold">
              {question.type === "choice" ? (isCorrect ? "回答正确" : "回答错误") : "参考答案"}
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-6 text-muted-foreground">
              {question.answerLetter ? `答案：${question.answerLetter}。` : ""}
              {cleanAnswerText(question.answerText)}
            </p>
            {question.answerImageRefs.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {question.answerImageRefs.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg bg-white">
                    <img src={url} alt={`第 ${question.number} 题答案图`} className="max-h-80 w-full object-contain" />
                  </a>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <Button variant="secondary" onClick={onPrevious} disabled={index === 0}>
            <ChevronLeft className="size-4" /> 上一题
          </Button>
          <div className="flex items-center gap-2">
            {!submitted ? (
              <Button onClick={onSubmit} disabled={question.type === "choice" && !selected}>
                <Eye className="size-4" />
                {question.type === "choice" ? "提交答案" : "显示参考答案"}
              </Button>
            ) : null}
            <Button onClick={onNext}>
              {index >= paper.questions.length - 1 ? "查看结果" : "下一题"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewPaper({ paper }: { paper: Exam408Paper }) {
  return (
    <div className="flex flex-col gap-5">
      {paper.sections.map((section) => {
        const questions = paper.questions.filter(
          (item) => item.type === section.type && item.number >= section.from && item.number <= section.to,
        );
        return (
          <section key={`${section.type}-${section.from}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="text-xs text-muted-foreground">
                  第 {section.from}–{section.to} 题 · 共 {section.totalScore} 分
                </p>
              </div>
              <Badge variant="muted">{questions.length} 题</Badge>
            </div>
            {questions.map((question) => (
              <ExamQuestionCard key={question.key} question={question} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function FinishPanel({
  paper,
  results,
  score,
  onRestart,
  onReview,
  onJump,
}: {
  paper: Exam408Paper;
  results: Record<number, ResultKind>;
  score: number;
  onRestart: () => void;
  onReview: () => void;
  onJump: (number: number) => void;
}) {
  const correct = Object.values(results).filter((value) => value === "correct").length;
  const wrong = Object.values(results).filter((value) => value === "wrong").length;
  const reviewed = Object.values(results).filter((value) => value === "reviewed").length;
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">{paper.paper.year} 年真题本轮完成</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            选择题答对 {correct} 题、答错 {wrong} 题；综合题已查看参考答案 {reviewed} 题。
          </p>
        </div>
        <div className="grid w-full max-w-xl grid-cols-3 gap-3">
          <Metric label="客观题得分" value={`${score} 分`} />
          <Metric label="正确" value={`${correct} 题`} />
          <Metric label="需复盘" value={`${wrong} 题`} />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRestart}>
            <RotateCcw className="size-4" /> 重新刷一遍
          </Button>
          <Button variant="secondary" onClick={onReview}>
            <Eye className="size-4" /> 整卷回看
          </Button>
          {Object.entries(results)
            .filter(([, value]) => value === "wrong")
            .slice(0, 4)
            .map(([number]) => (
              <Button key={number} variant="outline" size="sm" onClick={() => onJump(Number(number))}>
                复盘第 {number} 题
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TextQuestionNav({
  paper,
  current,
  onJump,
}: {
  paper: Exam408Paper;
  current: number;
  onJump: (number: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>跳到</span>
      <select
        value={current}
        onChange={(event) => onJump(Number(event.target.value))}
        className="h-8 rounded-lg border border-border/60 bg-card px-2 text-xs text-foreground"
      >
        {paper.questions.map((item) => (
          <option key={item.key} value={item.number}>
            第 {item.number} 题
          </option>
        ))}
      </select>
    </label>
  );
}

function QuestionImages({ question }: { question: Exam408Question }) {
  if (question.imageRefs.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.imageRefs.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="overflow-hidden rounded-xl border border-border/60 bg-white"
        >
          <img src={url} alt={`第 ${question.number} 题配图`} loading="lazy" className="max-h-96 w-full object-contain" />
        </a>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{value}</p>
    </div>
  );
}
