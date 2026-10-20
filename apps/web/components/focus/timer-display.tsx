"use client";

import { TimerDial } from "@/components/ui/timer-dial";
import { cn } from "@/lib/utils";
import { RING_C, RING_R, fmtClock } from "./format";

/** 环形进度 / 表盘 + 数字时钟（视觉正中）。S8-a 从 focus-timer.tsx 原样搬出。 */
export function TimerDisplay({
  ratio,
  running,
  remainingSeconds,
  timerView,
  mode,
  onToggleRun,
}: {
  ratio: number;
  running: boolean;
  remainingSeconds: number;
  timerView: "ring" | "dial";
  mode: "focus" | "exercise";
  onToggleRun: () => void;
}) {
  return (
    <div className={cn("relative flex flex-col items-center justify-center gap-3", "timer-pop")}>
      {timerView === "dial" ? (
        <>
          <TimerDial ratio={ratio} running={running} tone={mode === "exercise" ? "exercise" : "focus"} />
          <button
            onClick={onToggleRun}
            className="rounded-full border border-white/25 bg-white/10 px-6 py-1.5 font-mono text-[min(10vw,40px)] font-bold tabular-nums text-white backdrop-blur-md transition-colors hover:bg-white/20"
            aria-label={running ? "暂停" : "继续"}
          >
            {fmtClock(remainingSeconds)}
          </button>
        </>
      ) : (
        <div className="relative flex items-center justify-center">
          <svg width="min(72vw,340px)" height="min(72vw,340px)" viewBox="0 0 300 300" className="drop-shadow-[0_6px_30px_rgba(0,0,0,0.4)]">
            <defs>
              <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                {mode === "exercise" ? (
                  <>
                    <stop offset="0%" stopColor="#8bb7e8" />
                    <stop offset="100%" stopColor="#2f74c0" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#ffb25e" />
                    <stop offset="100%" stopColor="#ff6a5e" />
                  </>
                )}
              </linearGradient>
            </defs>
            <circle cx="150" cy="150" r={RING_R} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="12" />
            <circle
              cx="150"
              cy="150"
              r={RING_R}
              fill="none"
              stroke="url(#ring-grad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - ratio)}
              transform="rotate(-90 150 150)"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <button
            onClick={onToggleRun}
            className="absolute inset-0 m-auto flex h-[min(40vw,190px)] w-[min(40vw,190px)] items-center justify-center rounded-full text-white"
            aria-label={running ? "暂停" : "继续"}
          >
            <span className="font-mono text-[min(13vw,64px)] font-bold leading-none tabular-nums drop-shadow-[0_3px_18px_rgba(0,0,0,0.5)]">
              {fmtClock(remainingSeconds)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
