"use client";

import { cn } from "@/lib/utils";
import { FocusControls } from "./focus-controls";
import { PresetPicker } from "./preset-picker";
import { QuoteCard } from "./quote-card";
import { TimerDisplay } from "./timer-display";

/** 计时中/暂停页：状态 + 圆环/表盘 + 控制条 + 时长选择 + 每日一言。S8-a 从 focus-timer.tsx 原样搬出。 */
export function RunningScreen({
  sessionLabel,
  mode,
  running,
  ratio,
  remainingSeconds,
  timerView,
  minutes,
  endDisabled,
  onToggleRun,
  onReset,
  onEnd,
  onChangeView,
  onPickPreset,
}: {
  sessionLabel: string;
  mode: "focus" | "exercise";
  running: boolean;
  ratio: number;
  remainingSeconds: number;
  timerView: "ring" | "dial";
  minutes: number;
  endDisabled: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onEnd: () => void;
  onChangeView: (view: "ring" | "dial") => void;
  onPickPreset: (m: number) => void;
}) {
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4">
      {/* 任务名 + 状态 */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="max-w-xl truncate rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
          {sessionLabel}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/70">
          <span className={cn("size-1.5 rounded-full", running ? "bg-success animate-pulse" : "bg-white/40")} />
          {running ? (mode === "exercise" ? "运动中 · 保持节奏" : "专注中 · 保持节奏") : "已暂停"}
        </span>
      </div>

      {/* 环形进度 / 表盘 + 数字时钟（视觉正中）· v13 U3 */}
      <TimerDisplay
        ratio={ratio}
        running={running}
        remainingSeconds={remainingSeconds}
        timerView={timerView}
        mode={mode}
        onToggleRun={onToggleRun}
      />

      <FocusControls
        running={running}
        timerView={timerView}
        endDisabled={endDisabled}
        onToggleRun={onToggleRun}
        onReset={onReset}
        onEnd={onEnd}
        onChangeView={onChangeView}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <PresetPicker minutes={minutes} onPick={onPickPreset} />
      </div>

      <QuoteCard />

      {/* 移动端横屏提示 */}
      <p className="text-xs text-white/40 lg:hidden">横屏使用，数字时钟更沉浸</p>
    </div>
  );
}
