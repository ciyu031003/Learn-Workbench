"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Exam408Paper, Exam408Question } from "@/lib/exam-408";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  Keyboard,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { ExamQuestionCard } from "./exam-question-card";
import {
  PaperAnswerSheet,
  buildAnswerSheet,
  collectYears,
  filterQuestions,
  resolveKeyboardIntent,
  summarizeAnswers,
  type AnswerResult,
  type PaperMode,
  type ReviewFilter,
} from "./paper-answer-sheet";
import { QuestionImage } from "./question-image";
import { cleanAnswerText, cleanExamStem } from "./question-utils";
import { QuestionBlocks } from "@/components/question-blocks";
import { RichText } from "@/components/rich-text";

const KEYBOARD_HINT = "← / → 切换题目 · 1–4 选择选项 · Enter 提交";

export function PaperRunner({ paper }: { paper: Exam408Paper }) {
  const [mode, setMode] = useState<PaperMode>("exam");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Record<number, AnswerResult>>({});
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>({ type: "all", year: "all" });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const skipScroll = useRef(true);

  const question = paper.questions[index];
  const choiceCount = paper.questions.filter((item) => item.type === "choice").length;
  const comprehensiveCount = paper.questions.length - choiceCount;
  const years = useMemo(() => collectYears(paper.questions), [paper.questions]);
  const entries = useMemo(() => buildAnswerSheet(paper.questions, results), [paper.questions, results]);
  const summary = useMemo(() => summarizeAnswers(entries), [entries]);
  const reviewQuestions = useMemo(
    () => filterQuestions(paper.questions, reviewFilter),
    [paper.questions, reviewFilter],
  );

  /** 跳到某题号：恢复该题既有作答状态，已答的题回看时仍显示判定结果。 */
  const goToNumber = useCallback(
    (number: number) => {
      const nextIndex = paper.questions.findIndex((item) => item.number === number);
      if (nextIndex < 0) return;
      setIndex(nextIndex);
      setSelected(picks[number] ?? "");
      setSubmitted(Boolean(results[number]));
      setFinished(false);
      setSheetOpen(false);
    },
    [paper.questions, picks, results],
  );

  const submit = useCallback(() => {
    if (!question || submitted) return;
    if (question.type === "choice" && !selected) return;
    const result: AnswerResult =
      question.type === "comprehensive"
        ? "reviewed"
        : selected === question.answerLetter
          ? "correct"
          : "wrong";
    setResults((current) => ({ ...current, [question.number]: result }));
    if (selected) setPicks((current) => ({ ...current, [question.number]: selected }));
    setSubmitted(true);
  }, [question, selected, submitted]);

  const move = useCallback(
    (delta: number) => {
      const target = index + delta;
      if (target < 0) return;
      if (target > paper.questions.length - 1) {
        setFinished(true);
        return;
      }
      const number = paper.questions[target].number;
      setIndex(target);
      setSelected(picks[number] ?? "");
      setSubmitted(Boolean(results[number]));
    },
    [index, paper.questions, picks, results],
  );

  const next = useCallback(() => move(1), [move]);
  const previous = useCallback(() => move(-1), [move]);

  const restart = useCallback(() => {
    setIndex(0);
    setSelected("");
    setSubmitted(false);
    setFinished(false);
    setResults({});
    setPicks({});
    setSheetOpen(false);
  }, []);

  /** 切题后把题目卡滚到视口顶部，保持「一题一屏」的阅读起点（首帧不滚动）。 */
  useEffect(() => {
    if (mode !== "exam") return;
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    cardRef.current?.scrollIntoView({ block: "start" });
  }, [mode, index]);

  /** 键盘交互：←/→ 切题、1–4 选项、Enter 提交；输入控件内不拦截。 */
  useEffect(() => {
    if (mode !== "exam" || finished) return;
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const intent = resolveKeyboardIntent(event.key, {
        optionLetters: question?.options.map((option) => option.letter) ?? [],
        submitted,
      });
      if (intent.kind === "none") return;
      event.preventDefault();
      if (intent.kind === "previous") previous();
      else if (intent.kind === "next") next();
      else if (intent.kind === "select") setSelected(intent.letter);
      else submit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, finished, question, submitted, next, previous, submit]);

  /** 移动端答题卡抽屉：Esc 关闭。 */
  useEffect(() => {
    if (!sheetOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sheetOpen]);

  const switchMode = (nextMode: PaperMode) => {
    setMode(nextMode);
    setSheetOpen(false);
    if (nextMode === "exam") setFinished(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-7">
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
              <Button variant={mode === "exam" ? "default" : "secondary"} size="sm" onClick={() => switchMode("exam")}>
                考试模式
              </Button>
              <Button variant={mode === "review" ? "default" : "secondary"} size="sm" onClick={() => switchMode("review")}>
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
                setMode("exam");
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

      {mode === "exam" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div ref={cardRef} className="flex min-w-0 scroll-mt-4 flex-col gap-3">
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <span className="text-xs text-muted-foreground">
                第 {question?.number ?? 0} / {paper.questions.length} 题 · 已答 {summary.answered} 题
              </span>
              <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                <ClipboardList className="size-4" aria-hidden /> 答题卡
              </Button>
            </div>

            {finished ? (
              <FinishPanel
                paper={paper}
                summary={summary}
                wrongNumbers={Object.entries(results)
                  .filter(([, result]) => result === "wrong")
                  .map(([number]) => Number(number))}
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
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-4">
              <PaperAnswerSheet
                entries={entries}
                current={question?.number ?? 0}
                summary={summary}
                finished={finished}
                onJump={goToNumber}
                onFinish={() => setFinished(true)}
              />
            </div>
          </aside>
        </div>
      ) : (
        <ReviewPaper
          paper={paper}
          questions={reviewQuestions}
          filter={reviewFilter}
          years={years}
          results={results}
          onFilterChange={setReviewFilter}
        />
      )}

      {sheetOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="题号答题卡">
          <button
            type="button"
            aria-label="关闭答题卡"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-3 shadow-[var(--elev-2)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">题号答题卡</span>
              <Button variant="ghost" size="sm" onClick={() => setSheetOpen(false)}>
                <X className="size-4" aria-hidden /> 关闭
              </Button>
            </div>
            <PaperAnswerSheet
              entries={entries}
              current={question?.number ?? 0}
              summary={summary}
              finished={finished}
              onJump={goToNumber}
              onFinish={() => {
                setFinished(true);
                setSheetOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">内容来源与使用边界</p>
          <p>
            来源：{paper.source.name}（{paper.source.baseUrl}）。{paper.source.licenseNote}
          </p>
          <p>
            页面保留原题号、题型、分值与图片；题目图片已本地化，视频讲解仍打开原站。
            {summary.answered > 0 ? `本轮已作答 ${summary.answered} 题。` : ""}
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
  result?: AnswerResult;
  onSelect: (letter: string) => void;
  onSubmit: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onJump: (number: number) => void;
}) {
  const progress = Math.round(((index + 1) / paper.questions.length) * 100);
  const isCorrect = question.type === "choice" && result === "correct";
  const answerText = cleanAnswerText(question.answerText);

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

        <QuestionBlocks
          text={cleanExamStem(question.stem)}
          className="text-[15px] leading-7 text-foreground"
        />

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
                  <span className="min-w-0 flex-1 text-sm leading-6">
                    <RichText text={option.text} />
                  </span>
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
            <p className="mt-1 leading-6 text-muted-foreground">
              {question.answerLetter ? `答案：${question.answerLetter}。` : ""}
            </p>
            {answerText ? (
              <QuestionBlocks text={answerText} className="mt-1 text-sm text-muted-foreground" compact />
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
              {index >= paper.questions.length - 1 ? "交卷统计" : "下一题"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Keyboard className="size-3.5" aria-hidden /> {KEYBOARD_HINT}
        </p>
      </CardContent>
    </Card>
  );
}

function ReviewPaper({
  paper,
  questions,
  filter,
  years,
  results,
  onFilterChange,
}: {
  paper: Exam408Paper;
  questions: Exam408Question[];
  filter: ReviewFilter;
  years: number[];
  results: Record<number, AnswerResult>;
  onFilterChange: (filter: ReviewFilter) => void;
}) {
  const visible = new Set(questions.map((question) => question.number));
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <span>题型</span>
            <select
              value={filter.type}
              onChange={(event) =>
                onFilterChange({ ...filter, type: event.target.value as ReviewFilter["type"] })
              }
              className="h-9 rounded-lg border border-border/60 bg-card px-2 text-xs text-foreground"
            >
              <option value="all">全部题型</option>
              <option value="choice">选择题</option>
              <option value="comprehensive">综合应用题</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <span>年份</span>
            <select
              value={filter.year}
              onChange={(event) =>
                onFilterChange({
                  ...filter,
                  year: event.target.value === "all" ? "all" : Number(event.target.value),
                })
              }
              className="h-9 rounded-lg border border-border/60 bg-card px-2 text-xs text-foreground"
            >
              <option value="all">全部年份</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year} 年
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            已筛选 {questions.length} / {paper.questions.length} 题 · 解析默认折叠
          </p>
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            当前筛选条件下没有题目，换个题型或年份试试。
          </CardContent>
        </Card>
      ) : null}

      {paper.sections.map((section) => {
        const sectionQuestions = paper.questions.filter(
          (item) =>
            visible.has(item.number) &&
            item.type === section.type &&
            item.number >= section.from &&
            item.number <= section.to,
        );
        if (sectionQuestions.length === 0) return null;
        return (
          <section key={`${section.type}-${section.from}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="text-xs text-muted-foreground">
                  第 {section.from}–{section.to} 题 · 共 {section.totalScore} 分
                </p>
              </div>
              <Badge variant="muted">{sectionQuestions.length} 题</Badge>
            </div>
            {sectionQuestions.map((question) => (
              <ExamQuestionCard
                key={question.key}
                question={question}
                footer={
                  results[question.number] ? (
                    <Badge variant={results[question.number] === "correct" ? "success" : results[question.number] === "wrong" ? "danger" : "muted"}>
                      本轮{results[question.number] === "correct" ? "答对" : results[question.number] === "wrong" ? "答错" : "已看答案"}
                    </Badge>
                  ) : undefined
                }
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function FinishPanel({
  paper,
  summary,
  wrongNumbers,
  onRestart,
  onReview,
  onJump,
}: {
  paper: Exam408Paper;
  summary: ReturnType<typeof summarizeAnswers>;
  wrongNumbers: number[];
  onRestart: () => void;
  onReview: () => void;
  onJump: (number: number) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">{paper.paper.year} 年真题本轮完成</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            已作答 {summary.answered} / {summary.total} 题；选择题答对 {summary.correct} 题、答错 {summary.wrong} 题；
            综合题已查看参考答案 {summary.reviewed} 题。
          </p>
        </div>
        <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="客观题得分" value={`${summary.score} 分`} />
          <Metric label="正确率" value={`${summary.accuracy}%`} />
          <Metric label="未作答" value={`${summary.unanswered} 题`} />
          <Metric label="需复盘" value={`${summary.wrong} 题`} />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRestart}>
            <RotateCcw className="size-4" /> 重新刷一遍
          </Button>
          <Button variant="secondary" onClick={onReview}>
            <Eye className="size-4" /> 整卷回看
          </Button>
          {wrongNumbers.slice(0, 4).map((number) => (
            <Button key={number} variant="outline" size="sm" onClick={() => onJump(number)}>
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
        <QuestionImage
          key={url}
          src={url}
          alt={`第 ${question.number} 题配图`}
          className="max-h-96"
          wrapperClassName="rounded-xl border-border/60"
        />
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
