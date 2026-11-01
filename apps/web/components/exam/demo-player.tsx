"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Gauge, Pause, Play, RotateCcw } from "lucide-react";
import type { Exam408DemoStep } from "@/lib/exam-408-demos";

const SPEEDS = [0.5, 1, 1.5, 2] as const;
const BASE_FRAME_MS = 1600;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function readReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** 键盘快捷键只在非输入控件上生效（避免和页面里其它输入抢键） */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * 408 交互演示播放器（Web / 1.55）。
 *
 * 帧是 408card.top 逐帧镜像的静态图（webp/png），不是视频：
 * 播放 = 按倍速定时切帧；因此「单步 / 拖动进度条 / 倍速」都是同一套索引状态。
 * 尊重 prefers-reduced-motion：系统开启减少动态效果时不自动播放（仍可手动单步）。
 * 键盘：空格 播放/暂停，← / → 单步，R 重放（仅 Web）。
 */
export function DemoPlayer({
  steps,
  title,
  autoPlay = true,
}: {
  steps: Exam408DemoStep[];
  title?: string;
  autoPlay?: boolean;
}) {
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const [failedFrames, setFailedFrames] = useState<Set<number>>(() => new Set());
  const safeIndex = total === 0 ? 0 : Math.min(index, total - 1);
  const current = steps[safeIndex];

  const clampIndex = useCallback(
    (next: number) => {
      if (total === 0) return 0;
      return ((next % total) + total) % total;
    },
    [total],
  );

  const stepBy = useCallback(
    (delta: number) => {
      setPlaying(false);
      setIndex((previous) => clampIndex(previous + delta));
    },
    [clampIndex],
  );

  const togglePlay = useCallback(() => {
    if (total <= 1) return;
    setPlaying((value) => !value);
  }, [total]);

  const replay = useCallback(() => {
    setIndex(0);
    setPlaying(total > 1);
  }, [total]);

  // 只有明确「未开启减弱动态」才自动播放；用 0ms 定时器避免在 effect 内同步 setState
  useEffect(() => {
    if (!autoPlay || reducedMotion || total <= 1) return;
    const timer = window.setTimeout(() => setPlaying(true), 0);
    return () => window.clearTimeout(timer);
  }, [autoPlay, reducedMotion, total]);

  useEffect(() => {
    if (!playing || total <= 1) return;
    const timer = window.setTimeout(
      () => setIndex((previous) => clampIndex(previous + 1)),
      BASE_FRAME_MS / speed,
    );
    return () => window.clearTimeout(timer);
  }, [playing, total, speed, safeIndex, clampIndex]);

  // 键盘快捷键（页面只有一个播放器时是全局的；输入框里不抢键）
  useEffect(() => {
    if (total === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepBy(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepBy(1);
        return;
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        replay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, stepBy, replay, total]);

  const frameFailed = current?.frame ? failedFrames.has(safeIndex) : false;
  const frame = current?.frame ?? null;
  const progress = total <= 1 ? 0 : (safeIndex / (total - 1)) * 100;

  const speedLabel = useMemo(() => `${speed}x`, [speed]);
  const nextSpeed = () => {
    const at = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(at + 1) % SPEEDS.length] ?? 1);
  };

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        该演示暂无步骤数据。
      </div>
    );
  }

  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Play className="size-3.5 text-primary" />
          {title ? `演示 · ${title}` : "408 交互演示"}
        </figcaption>
        <span className="text-xs tabular-nums text-muted-foreground">
          第 {safeIndex + 1} / {total} 步
        </span>
      </div>

      <div className="relative mx-auto flex w-full max-w-2xl items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-[radial-gradient(circle_at_top,theme(colors.muted.DEFAULT),transparent_70%)]">
        {frame && !frameFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- 逐帧镜像资产尺寸不定，且不走 Next 图片优化（本地 public 目录）
          <img
            key={frame}
            src={frame}
            alt={current?.explain || `${title ?? "408 演示"} 第 ${safeIndex + 1} 步`}
            className="h-auto max-h-[420px] w-full object-contain"
            onError={() =>
              setFailedFrames((previous) => {
                const next = new Set(previous);
                next.add(safeIndex);
                return next;
              })
            }
          />
        ) : (
          <div className="flex min-h-[180px] w-full items-center justify-center px-6 text-center text-xs leading-5 text-muted-foreground">
            {frame ? "这一帧图片暂时无法加载（演示资产可能尚未导入）" : "该步骤为纯文字说明，没有配图"}
          </div>
        )}
      </div>

      <p aria-live="polite" className="min-h-[3rem] rounded-md bg-muted/50 px-3 py-2 text-sm leading-6 text-foreground/90">
        {current?.explain || "（本步无文字说明）"}
      </p>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only">演示进度</span>
          <input
            type="range"
            min={0}
            max={Math.max(total - 1, 0)}
            step={1}
            value={safeIndex}
            onChange={(event) => {
              setPlaying(false);
              setIndex(Number(event.currentTarget.value) || 0);
            }}
            className="h-1.5 w-full cursor-pointer accent-[var(--primary)]"
            aria-label="演示进度"
          />
        </label>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={togglePlay}
          disabled={total <= 1}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? "暂停" : "播放"}
        </button>
        <button
          type="button"
          onClick={() => stepBy(-1)}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
          aria-label="上一步"
        >
          <ChevronLeft className="size-3.5" /> 上一步
        </button>
        <button
          type="button"
          onClick={() => stepBy(1)}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
          aria-label="下一步"
        >
          下一步 <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={replay}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
          aria-label="重放"
        >
          <RotateCcw className="size-3.5" /> 重放
        </button>
        <button
          type="button"
          onClick={nextSpeed}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
          aria-label={`倍速，当前 ${speedLabel}`}
        >
          <Gauge className="size-3.5" /> {speedLabel}
        </button>
        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
          空格 播放/暂停 · ←/→ 单步 · R 重放
        </span>
      </div>

      {reducedMotion === true ? (
        <p className="text-[11px] text-muted-foreground">
          已根据系统「减少动态效果」设置关闭自动播放，可手动单步查看。
        </p>
      ) : null}
    </figure>
  );
}