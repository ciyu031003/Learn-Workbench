"use client";

import { useEffect, useState } from "react";
import { algorithmAnimations } from "@learn-workbench/content";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";

const FRAME_MS = 1200;

/**
 * 算法动图播放器：把 `algorithmAnimations[key]` 的多帧 SVG 逐帧播放出来。
 *
 * 内容由 `packages/content` 自产并已过内容质量门禁（无危险 HTML：script、style、事件属性、javascript 伪协议），
 * 因此这里用 dangerouslySetInnerHTML 直接内联；react-native-svg 不支持 SMIL，
 * 移动端用同款「按帧切换」的思路渲染，两端表现一致。
 */
export function AlgorithmAnimation({ keys }: { keys: string[] }) {
  const [keyIndex, setKeyIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  const safeIndex = Math.min(keyIndex, keys.length - 1);
  const activeKey = keys[safeIndex];
  const frames = algorithmAnimations[activeKey] ?? [];
  const total = frames.length;

  useEffect(() => {
    if (!playing || total <= 1) return;
    const timer = setInterval(() => {
      setFrame((previous) => (previous + 1) % total);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, total]);

  if (total === 0) return null;

  const current = frames[Math.min(frame, total - 1)];
  const selectKey = (index: number) => {
    setKeyIndex(index);
    setFrame(0);
    setPlaying(true);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Play className="size-3.5" /> 算法演示（SVG 动图）
        </p>
        {keys.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {keys.map((key, index) => (
              <button
                key={key}
                type="button"
                onClick={() => selectKey(index)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  index === safeIndex
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {key.replace(/^anim-/, "").replace(/-/g, " ")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="mx-auto w-full max-w-md [&>svg]:h-auto [&>svg]:w-full"
        // 内容自产（packages/content）且已过危险片段门禁，因此可安全内联
        dangerouslySetInnerHTML={{ __html: current.svg }}
      />

      <p className="min-h-[2.5rem] rounded-md bg-muted/50 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
        {current.caption}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
          >
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "暂停" : "播放"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setFrame(0);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
          >
            <RotateCcw className="size-3" /> 重放
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setFrame((previous) => (previous - 1 + total) % total);
            }}
            className="rounded-md bg-muted p-1 text-muted-foreground transition-colors hover:bg-muted/70"
            aria-label="上一帧"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {Math.min(frame, total - 1) + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setFrame((previous) => (previous + 1) % total);
            }}
            className="rounded-md bg-muted p-1 text-muted-foreground transition-colors hover:bg-muted/70"
            aria-label="下一帧"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
