"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { PresetPicker } from "./preset-picker";

/** 未开始（idle）页：任务名 + 倒计时/秒表切换 + 时长选择 + 开始按钮。S8-a 从 focus-timer.tsx 原样搬出。 */
export function StartScreen({
  sessionLabel,
  mode,
  timerMode,
  minutes,
  onChangeTimerMode,
  onPickPreset,
  onBegin,
}: {
  sessionLabel: string;
  mode: "focus" | "exercise";
  timerMode: "countdown" | "stopwatch";
  minutes: number;
  onChangeTimerMode: (mode: "countdown" | "stopwatch") => void;
  onPickPreset: (m: number) => void;
  onBegin: () => void;
}) {
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="max-w-xl truncate rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
          {sessionLabel}
        </span>
        <span className="text-xs text-white/70">{timerMode === "stopwatch" ? "准备开始 · 正向计时" : `准备开始 · ${minutes} 分钟`}</span>
      </div>

      {/* V3 计时模式切换 */}
      {mode === "focus" ? (
        <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-md">
          {(
            [
              { key: "countdown", label: "倒计时" },
              { key: "stopwatch", label: "正向秒表" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => onChangeTimerMode(o.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-all",
                timerMode === o.key ? "bg-primary/40 text-white" : "text-white/70 hover:text-white"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {timerMode === "countdown" ? (
          <PresetPicker minutes={minutes} onPick={onPickPreset} />
        ) : (
          <p className="text-sm text-white/70">秒表将从 00:00 开始正向计时，结束即记录本次时长</p>
        )}
      </div>

      <button
        onClick={onBegin}
        className="flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-strong px-10 py-4 text-base font-semibold text-white shadow-[0_10px_40px_rgba(23,37,84,0.4)] transition-all hover:brightness-105"
      >
        <Play className="size-5" /> {mode === "exercise" ? "开始运动" : timerMode === "stopwatch" ? "开始计时" : "开始专注"}
      </button>
      <p className="text-xs text-white/50">开始后将进入全屏，可随时暂停或结束</p>
    </div>
  );
}
