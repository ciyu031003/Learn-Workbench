"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ChevronDown, ExternalLink, Loader2, RotateCcw } from "lucide-react";

import { ExamQuestionCard } from "@/components/exam/exam-question-card";
import type { Exam408Question } from "@/lib/exam-408";
import { cn } from "@/lib/utils";

/**
 * 知识点页「某一年的真题」折叠块（P7：按年懒加载）。
 *
 * 首屏服务端只输出年份 / 题数 / 分值；展开时才请求
 * /api/exam/408/point-questions?key=…&year=…，把当年题目交给 ExamQuestionCard 渲染。
 *
 * - 已加载年份缓存：模块级 Map（同一页面多次展开/折叠、返回再进都不重复请求）；
 * - 无 JS 降级：details 原生可展开，<noscript> 提示「展开后加载」并给出套卷页链接；
 * - a11y：details/summary 原生键盘可达，内容区 aria-busy + aria-live 播报加载/错误。
 */

/** 已加载年份缓存（key = 知识点 key + 年份）。真题只读，模块级缓存不失效。 */
const YEAR_CACHE = new Map<string, Exam408Question[]>();

/** 从 /learn/408/points/<...key> 路径里取回知识点 key（用于页面没显式传 pointKey 的兜底）。 */
export function pointKeyFromPath(pathname: string | null): string {
  if (!pathname) return "";
  const marker = "/learn/408/points/";
  const index = pathname.indexOf(marker);
  if (index < 0) return "";
  const raw = pathname.slice(index + marker.length).split(/[?#]/)[0] ?? "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function yearCacheKey(pointKey: string, year: number): string {
  return pointKey + ":" + year;
}

export interface PointQuestionYearProps {
  year: number;
  count: number;
  totalPoints: number;
  /** 服务端推导出的知识点 key；缺省时从 pathname 兜底 */
  pointKey?: string;
}

type LoadStatus = "idle" | "loading" | "ready" | "error";

export function PointQuestionYear({ year, count, totalPoints, pointKey }: PointQuestionYearProps) {
  const pathname = usePathname();
  const effectivePointKey = (pointKey || pointKeyFromPath(pathname)).trim();
  const cachedAtMount = effectivePointKey
    ? YEAR_CACHE.get(yearCacheKey(effectivePointKey, year)) ?? null
    : null;
  const [questions, setQuestions] = React.useState<Exam408Question[] | null>(cachedAtMount);
  const [status, setStatus] = React.useState<LoadStatus>(cachedAtMount ? "ready" : "idle");
  const [errorMessage, setErrorMessage] = React.useState("");
  const requestRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  const load = React.useCallback(async () => {
    if (!effectivePointKey) {
      setStatus("error");
      setErrorMessage("无法识别知识点 key，请刷新页面重试。");
      return;
    }
    const cacheKey = yearCacheKey(effectivePointKey, year);
    const cached = YEAR_CACHE.get(cacheKey);
    if (cached) {
      setQuestions(cached);
      setStatus("ready");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setErrorMessage("");
    try {
      const response = await fetch(
        "/api/exam/408/point-questions?key=" +
          encodeURIComponent(effectivePointKey) +
          "&year=" +
          year,
        { signal: controller.signal, headers: { accept: "application/json" } },
      );
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = (await response.json()) as { questions?: Exam408Question[] };
      const list = Array.isArray(data.questions) ? data.questions : [];
      YEAR_CACHE.set(cacheKey, list);
      setQuestions(list);
      setStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "加载失败");
    }
  }, [effectivePointKey, year]);

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open && status === "idle") void load();
  };

  return (
    <details className="group rounded-xl border border-border bg-surface/70" onToggle={handleToggle}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold">{year > 0 ? year + " 年" : "未标注年份"}</span>
        <span className="text-xs text-muted-foreground">
          {count} 题 · {totalPoints} 分
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          {status === "loading" ? "加载中" : "展开后加载"}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div
        className="flex flex-col gap-4 border-t border-border p-4"
        aria-busy={status === "loading"}
      >
        <noscript>
          <p className="text-sm text-muted-foreground">
            展开后加载需要 JavaScript，也可以直接
            <a className="mx-1 font-medium text-primary underline" href={"/learn/408/papers/" + year}>
              打开 {year} 年套卷
            </a>
            查看。
          </p>
        </noscript>

        <p aria-live="polite" className="sr-only">
          {status === "loading"
            ? "正在加载 " + year + " 年真题"
            : status === "ready"
              ? year + " 年真题已加载，共 " + (questions?.length ?? 0) + " 题"
              : status === "error"
                ? year + " 年真题加载失败"
                : ""}
        </p>

        {status === "loading" ? (
          <div className="flex flex-col gap-2 py-2" aria-hidden="true">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> 正在加载 {year} 年真题…
            </div>
            <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
            <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
          </div>
        ) : null}

        {status === "error" ? (
          <div className="flex flex-col items-start gap-2 rounded-lg bg-warning/10 px-3 py-3 text-sm text-warning-strong">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              {year} 年真题加载失败{errorMessage ? "（" + errorMessage + "）" : ""}
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-lg border border-warning/30 bg-surface px-2.5 py-1 text-xs font-medium"
            >
              <RotateCcw className="size-3.5" /> 重试
            </button>
          </div>
        ) : null}

        {status === "ready" && questions && questions.length === 0 ? (
          <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
            <span>{year > 0 ? year + " 年" : "该年份"}暂无关联题目。</span>
            <Link
              href={"/learn/408/papers/" + year}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> 打开 {year} 年套卷
            </Link>
          </div>
        ) : null}

        {status === "ready" && questions && questions.length > 0 ? (
          <>
            <div className={cn("flex flex-col gap-4")}>
              {questions.map((question) => (
                <ExamQuestionCard key={question.key} question={question} />
              ))}
            </div>
            <Link
              href={"/learn/408/papers/" + year}
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> 在 {year} 年套卷中查看
            </Link>
          </>
        ) : null}
      </div>
    </details>
  );
}
