"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { InterviewAttempt, InterviewMode, InterviewQuestion, InterviewStats, JobApplication, MarketGapItem } from "@learn-workbench/shared/schemas";
import { interviewModeLabels } from "@learn-workbench/shared/labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { QuestionBlocks } from "@/components/question-blocks";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import {
  CheckCircle2, ChevronLeft, ClipboardList, Loader2, PenLine, Sparkles, TrendingUp, XCircle,
} from "lucide-react";

const DIFF_LABEL: Record<string, string> = { easy: "易", medium: "中", hard: "难" };
const DIFF_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

/** 市场热点技能（规范化名）→ 面试刷题模块（启发式映射，用于「市场驱动备考」推荐） */
const MODULE_BY_SKILL: Record<string, string> = {
  linux: "Linux云运维", docker: "Linux云运维", k8s: "Linux云运维", kubernetes: "Linux云运维",
  nginx: "Linux云运维", shell: "Linux云运维", cloud: "Linux云运维", server: "Linux云运维",
  sql: "ETL", etl: "ETL", mysql: "ETL", data: "ETL", mongodb: "ETL", postgresql: "ETL",
  spark: "ETL", hadoop: "ETL", "data-warehouse": "ETL",
  network: "通信", tcp: "通信", http: "通信", protocol: "通信", networking: "通信",
  llm: "Agent", ai: "Agent", agent: "Agent", python: "Agent", nlp: "Agent",
  pytorch: "Agent", tensorflow: "Agent",
};

function moduleForSkill(skill: string): string | null {
  const key = (skill ?? "").trim().toLowerCase();
  return MODULE_BY_SKILL[key] ?? null;
}

interface QuestionModule { module: string; count: number; }

export default function CareerInterviewPage() {
  const pushToast = useToastStore((s) => s.push);

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [modules, setModules] = useState<QuestionModule[]>([]);
  const [attempts, setAttempts] = useState<InterviewAttempt[]>([]);
  const [stats, setStats] = useState<InterviewStats | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // 刷题
  const [selModule, setSelModule] = useState("");
  const [selDiff, setSelDiff] = useState("");
  const [quizIdx, setQuizIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean | null; answer: string } | null>(null);

  // 记录面试
  const [recMode, setRecMode] = useState<InterviewMode>("interview");
  const [recRating, setRecRating] = useState<number>(0);
  const [recNote, setRecNote] = useState("");
  const [recAppId, setRecAppId] = useState<number | "">("");
  const [recBusy, setRecBusy] = useState(false);
  const [marketGaps, setMarketGaps] = useState<MarketGapItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [qRes, aRes] = await Promise.all([
        fetch("/api/questions"),
        fetch("/api/questions/attempts"),
      ]);
      if (!qRes.ok || !aRes.ok) throw new Error("面试数据加载失败");
      const qData = await qRes.json();
      const aData = await aRes.json();
      setQuestions(qData.questions ?? []);
      setModules(qData.modules ?? []);
      setAttempts(aData.attempts ?? []);
      setStats(aData.stats ?? null);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "面试数据加载失败", "error");
    } finally {
      setLoading(false);
    }
    try {
      const r = await fetch("/api/jobs/applications");
      if (r.ok) setApplications((await r.json()).applications ?? []);
    } catch { /* 关联求职记录非必须 */ }
    try {
      const r = await fetch("/api/skills/gaps?limit=8");
      if (r.ok) setMarketGaps((await r.json()).gaps ?? []);
    } catch { /* 市场缺口提示非必须 */ }
  }, [pushToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => questions.filter((q) =>
    (!selModule || q.module === selModule) && (!selDiff || q.difficulty === selDiff)
  ), [questions, selModule, selDiff]);
  const current = filtered[quizIdx] ?? null;

  const submitAnswer = async () => {
    if (!current) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/questions/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: current.id, mode: "quiz", chosenAnswer: answer }),
      });
      if (!r.ok) throw new Error("提交作答失败");
      setResult(await r.json());
      const aRes = await fetch("/api/questions/attempts");
      if (aRes.ok) {
        const d = await aRes.json();
        setAttempts(d.attempts ?? []);
        setStats(d.stats ?? null);
      }
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "提交作答失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const nextQuestion = () => {
    if (quizIdx + 1 < filtered.length) setQuizIdx(quizIdx + 1);
    else if (quizIdx >= filtered.length - 1) pushToast("本轮已刷完", "success");
    setAnswer("");
    setResult(null);
  };

  const recordInterview = async () => {
    setRecBusy(true);
    try {
      const r = await fetch("/api/questions/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: recMode,
          selfRating: recRating || null,
          note: recNote,
          applicationId: recAppId === "" ? null : recAppId,
        }),
      });
      if (!r.ok) throw new Error("记录失败");
      setRecNote("");
      setRecRating(0);
      setRecAppId("");
      pushToast("已记录", "success");
      const aRes = await fetch("/api/questions/attempts");
      if (aRes.ok) {
        const d = await aRes.json();
        setAttempts(d.attempts ?? []);
        setStats(d.stats ?? null);
      }
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "记录失败", "error");
    } finally {
      setRecBusy(false);
    }
  };

  const accuracy = stats && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const moduleStats = stats?.byModule ?? [];

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="面试"
        description="题库刷题 · 面试记录与复盘 · 与求职管道联动"
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/career/applications"><ClipboardList className="size-4" /> 我的求职</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
        {/* 题库刷题 */}
        <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default xl:col-span-2">
          <div className="flex items-center gap-2 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
              <Sparkles className="size-4 text-primary" />
            </span>
            <h2 className="text-headline-medium text-text-primary">题库刷题</h2>
          </div>
          <div className="flex flex-col gap-4 px-5 pb-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-body-medium text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> 加载题库…
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="题库为空或筛选无结果"
                hint="换个模块/难度，或运行 scripts/seed_interview_questions.mjs 导入种子题目"
              />
            ) : current ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={selModule} onChange={(e) => { setSelModule(e.target.value); setQuizIdx(0); setResult(null); }} className="paper-select h-9 rounded-lg px-2 text-body-medium">
                      <option value="">全部模块</option>
                      {modules.map((m) => <option key={m.module} value={m.module}>{m.module}（{m.count}）</option>)}
                    </select>
                    <select value={selDiff} onChange={(e) => { setSelDiff(e.target.value); setQuizIdx(0); setResult(null); }} className="paper-select h-9 rounded-lg px-2 text-body-medium">
                      <option value="">全部难度</option>
                      <option value="easy">易</option>
                      <option value="medium">中</option>
                      <option value="hard">难</option>
                    </select>
                    <Badge variant="muted">第 {quizIdx + 1} / {filtered.length} 题</Badge>
                  </div>
                </div>
                <div className="rounded-2xl border border-separator-border bg-background-primary-default p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="muted">{current.module}</Badge>
                    <Badge variant={DIFF_VARIANT[current.difficulty] ?? "muted"}>{DIFF_LABEL[current.difficulty]}</Badge>
                  </div>
                  <p className="text-body-medium leading-relaxed text-text-primary">
                    <RichText text={current.question} />
                  </p>
                </div>
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="输入你的回答…" />
                <div className="flex items-center gap-2">
                  <Button onClick={submitAnswer} disabled={busy || !answer.trim()} className="gap-2">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} 提交作答
                  </Button>
                  <Button variant="ghost" onClick={nextQuestion} disabled={busy}>下一题 →</Button>
                </div>
                {result ? (
                  <div className={cn("rounded-2xl border p-3 text-body-medium", result.isCorrect ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10")}>
                    <p className="flex items-center gap-1.5 font-semibold text-text-primary">
                      {result.isCorrect ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-warning" />}
                      {result.isCorrect ? "回答正确" : "参考答案如下"}
                    </p>
                    {result.answer ? (
                      <QuestionBlocks text={result.answer} className="mt-1.5 text-body-medium text-muted-foreground" compact />
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </section>

        {/* 答题统计 */}
        <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
          <div className="flex items-center gap-2 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
              <CheckCircle2 className="size-4 text-success" />
            </span>
            <h2 className="text-headline-medium text-text-primary">答题统计</h2>
          </div>
          <div className="flex flex-col gap-4 px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "答题数", value: String(stats?.total ?? 0) },
                { label: "正确率", value: `${accuracy}%` },
                { label: "面试记录", value: String(stats?.interviewCount ?? 0) },
                { label: "平均自评", value: stats?.avgRating ? stats.avgRating.toFixed(1) : "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border-button-default bg-background-primary-default px-3 py-3 text-center">
                  <div className="text-title-2-semibold tabular-nums text-text-primary">{item.value}</div>
                  <div className="text-caption-1-medium text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              <p className="text-caption-1-semibold text-muted-foreground">按模块</p>
              {moduleStats.length === 0 ? (
                <p className="text-caption-1-medium text-muted-foreground">暂无答题</p>
              ) : (
                <ScrollFade className={moduleStats.length > 3 ? "h-[180px]" : ""}>
                  <div className="flex flex-col gap-2 pe-1">
                    {moduleStats.map((m) => (
                      <div key={m.module} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-caption-1-medium">
                          <span className="truncate text-text-primary">{m.module}</span>
                          <span className="shrink-0 text-muted-foreground">{m.correct}/{m.total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-background-tertiary-default">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${m.total ? (m.correct / m.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollFade>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 市场驱动备考：市场高频需求 × 我的缺口 → 优先刷对应模块 + 学习路线 */}
      <section className="flex flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
        <div className="flex items-center gap-2 px-5 pb-3 pt-5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
            <TrendingUp className="size-4 text-chart-7" />
          </span>
          <h2 className="text-headline-medium text-text-primary">市场驱动备考</h2>
        </div>
        <div className="flex flex-col gap-3 px-5 pb-5">
          <p className="text-caption-1-medium text-muted-foreground">
            以下技能是市场高频需求但你尚未掌握 —— 按市场热点优先复习，命中对应刷题模块，并随时加入学习路线。
          </p>
          {marketGaps.length === 0 ? (
            <p className="text-caption-1-medium text-muted-foreground">暂无市场缺口提示（你已覆盖主要市场技能，或市场数据仍在积累）</p>
          ) : (
            <ScrollFade className={marketGaps.length > 4 ? "h-[340px]" : ""}>
              <div className="grid gap-2 pe-1 sm:grid-cols-2">
                {marketGaps.map((g) => {
                  const mod = moduleForSkill(g.skill);
                  return (
                    <div key={g.skillId} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border-button-default bg-background-primary-default px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body-semibold text-text-primary">{g.skill}</span>
                        <Badge variant="muted">需求 {g.jobCount} 岗位</Badge>
                        {mod ? <Badge variant="accent">去刷「{mod}」</Badge> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {g.phaseId ? (
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-caption-1-medium">
                            <Link href={`/roadmap#phase-${g.phaseId}`}>去学 →</Link>
                          </Button>
                        ) : null}
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-caption-1-medium">
                          <Link href="/career/market">市场分析</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollFade>
          )}
        </div>
      </section>

      {/* 记录面试 + 复盘 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
        <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
          <div className="flex items-center gap-2 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
              <PenLine className="size-4 text-primary" />
            </span>
            <h2 className="text-headline-medium text-text-primary">记录一场面试</h2>
          </div>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <select value={recMode} onChange={(e) => setRecMode(e.target.value as InterviewMode)} className="paper-select h-9 rounded-lg px-2 text-body-medium">
              <option value="interview">真实面试</option>
              <option value="mock">模拟面试</option>
              <option value="quiz">题库刷题</option>
            </select>
            <div className="flex flex-col gap-1">
              <label className="text-caption-1-medium text-muted-foreground">自评（1-5）</label>
              <select value={recRating} onChange={(e) => setRecRating(Number(e.target.value))} className="paper-select h-9 rounded-lg px-2 text-body-medium">
                <option value={0}>未评分</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 分</option>)}
              </select>
            </div>
            <select value={recAppId === "" ? "" : String(recAppId)} onChange={(e) => setRecAppId(e.target.value === "" ? "" : Number(e.target.value))} className="paper-select h-9 rounded-lg px-2 text-body-medium">
              <option value="">关联求职记录（可选）</option>
              {applications.map((a) => <option key={a.id} value={a.id}>{a.jobTitle || `#${a.id}`}</option>)}
            </select>
            <Textarea value={recNote} onChange={(e) => setRecNote(e.target.value)} rows={3} placeholder="复盘结论 / 待改进点 / 常见问题…" />
            <Button onClick={recordInterview} disabled={recBusy} className="gap-2">
              {recBusy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} 保存记录
            </Button>
          </div>
        </section>

        <section className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default xl:col-span-2">
          <div className="flex items-center gap-2 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
              <ClipboardList className="size-4 text-chart-9" />
            </span>
            <h2 className="text-headline-medium text-text-primary">复盘记录</h2>
          </div>
          <div className="px-5 pb-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-body-medium text-muted-foreground"><Loader2 className="size-4 animate-spin" /> 加载中…</div>
            ) : attempts.length === 0 ? (
              <EmptyState icon={ClipboardList} title="还没有答题/面试记录" hint="去刷题，或在上方记录一场面试" />
            ) : (
              <ScrollFade className={attempts.length > 4 ? "h-[340px]" : ""}>
                <div className="flex flex-col gap-2 pe-1">
                  {attempts.slice(0, 15).map((a) => (
                    <div key={a.id} className="rounded-2xl border border-border-button-default bg-background-primary-default p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-caption-1-semibold text-text-primary">{interviewModeLabels[a.mode]}</span>
                        <span className="text-caption-1-medium text-muted-foreground">{new Date(a.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                      <p className="mt-1 text-caption-1-medium text-muted-foreground">
                        {a.module || "自由"}{a.question ? ` · ${a.question}` : ""}{a.jobTitle ? ` · ${a.jobTitle}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {a.selfRating ? <Badge variant="muted">自评 {a.selfRating}/5</Badge> : null}
                        {a.isCorrect != null ? <Badge variant={a.isCorrect ? "default" : "muted"}>{a.isCorrect ? "正确" : "需复习"}</Badge> : null}
                      </div>
                      {a.note ? <p className="mt-1.5 text-caption-1-medium text-muted-foreground">{a.note}</p> : null}
                    </div>
                  ))}
                </div>
              </ScrollFade>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
