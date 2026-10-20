"use client";

import { CircleDot, Gauge, Pause, Play, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/** 控制按钮：暂停/重置/结束 + 圆环/表盘视图切换。S8-a 从 focus-timer.tsx 原样搬出。 */
export function FocusControls({
  running,
  timerView,
  endDisabled,
  onToggleRun,
  onReset,
  onEnd,
  onChangeView,
}: {
  running: boolean;
  timerView: "ring" | "dial";
  endDisabled: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onEnd: () => void;
  onChangeView: (view: "ring" | "dial") => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-4">
      <button
        onClick={onToggleRun}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25"
        aria-label={running ? "暂停" : "继续"}
      >
        {running ? <Pause className="size-6" /> : <Play className="size-6 translate-x-0.5" />}
      </button>
      <button
        onClick={onReset}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25"
        aria-label="重置"
      >
        <RotateCcw className="size-5" />
      </button>
      <button
        onClick={onEnd}
        disabled={endDisabled}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 disabled:opacity-40"
        aria-label="结束计时"
      >
        <Square className="size-5" />
      </button>
      {/* v13 U3：圆环 / 表盘视图切换 */}
      <div
        role="group"
        aria-label="计时视图"
        className="ml-1 flex items-center gap-0.5 rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-md"
      >
        <button
          onClick={() => onChangeView("ring")}
          aria-pressed={timerView === "ring"}
          aria-label="圆环视图"
          className={cn(
            "press grid h-8 w-8 place-items-center rounded-full transition-colors",
            timerView === "ring" ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
          )}
        >
          <CircleDot className="size-4" />
        </button>
        <button
          onClick={() => onChangeView("dial")}
          aria-pressed={timerView === "dial"}
          aria-label="表盘视图"
          className={cn(
            "press grid h-8 w-8 place-items-center rounded-full transition-colors",
            timerView === "dial" ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
          )}
        >
          <Gauge className="size-4" />
        </button>
      </div>
    </div>
  );
}
