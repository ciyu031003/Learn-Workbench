"use client";

import { CircleDot, Gauge, Pause, Play, RotateCcw, SkipForward, Square, Target, Volume2 } from "lucide-react";
import { FOCUS_SCENES } from "@learn-workbench/shared/focus-scenes";
import { cn } from "@/lib/utils";
import { useFocusBgStore } from "@/store/focus-bg-store";
import { fmtClock } from "./format";

/** Immersive running screen: scene photo, glass timer card, floating control dock. */
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
  onSkip,
  onEnd,
  onChangeView,
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
  onSkip: () => void;
  onEnd: () => void;
  onChangeView: (view: "ring" | "dial") => void;
}) {
  const bg = useFocusBgStore();
  const scene = FOCUS_SCENES.find((item) => item.id === bg.galleryId) ?? FOCUS_SCENES[0];
  const progress = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));

  return (
    <div className="relative z-10 flex flex-1 flex-col justify-end px-4 pb-5 pt-2">
      <div className="pointer-events-none absolute right-5 top-1 text-xs font-medium text-white/70">
        {scene.name}
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 lg:flex-row lg:items-end">
        <section className="w-full overflow-hidden rounded-2xl border border-white/25 bg-black/30 p-4 shadow-2xl backdrop-blur-2xl lg:w-[286px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold tracking-[0.08em] text-white/70">POMODORO #1</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/80">
              <span className={cn("size-1.5 rounded-full", running ? "bg-emerald-300" : "bg-amber-300")} />
              {running ? (mode === "exercise" ? "运动中" : "学习中") : "已暂停"}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-white/55">{sessionLabel}</p>
          <div className="mt-1 flex items-center gap-3">
            {timerView === "ring" ? (
              <svg viewBox="0 0 48 48" className="size-12 shrink-0 -rotate-90" aria-hidden>
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20}
                  strokeDashoffset={(2 * Math.PI * 20) * (1 - ratio)}
                />
              </svg>
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5">
                <Gauge className="size-5 text-white/75" />
              </span>
            )}
            <button
              onClick={onToggleRun}
              className="block min-w-0 flex-1 text-left font-mono text-[48px] font-light leading-none tabular-nums text-white sm:text-[54px]"
              aria-label={running ? "暂停计时" : "继续计时"}
            >
              {fmtClock(remainingSeconds)}
            </button>
          </div>
          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white/90 transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45">
            <span>本轮进度</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="text-[10px] text-white/40">{minutes} 分钟番茄钟</span>
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "ring", icon: CircleDot, label: "圆环" },
                  { key: "dial", icon: Gauge, label: "表盘" },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  onClick={() => onChangeView(o.key)}
                  aria-pressed={timerView === o.key}
                  aria-label={`${o.label}视图`}
                  title={`${o.label}视图`}
                  className={cn(
                    "grid size-6 place-items-center rounded-full transition-colors",
                    timerView === o.key ? "bg-white/20 text-white" : "text-white/45 hover:text-white"
                  )}
                >
                  <o.icon className="size-3.5" />
                </button>
              ))}
            </div>
          </div>
        </section>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <label className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3.5 py-2 backdrop-blur-xl">
            <Target className="size-3.5 shrink-0 text-white/70" />
            <input
              value={bg.goal}
              onChange={(e) => bg.setGoal(e.target.value)}
              placeholder="今日目标 · 写下今天想完成的事…"
              maxLength={60}
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
            />
          </label>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-full border border-white/25 bg-black/30 px-3 py-2 shadow-2xl backdrop-blur-2xl">
            <label className="flex items-center gap-1.5 text-[10px] text-white/60">
              音乐
              <input
                type="range"
                min={0}
                max={100}
                value={bg.musicVolume}
                onChange={(e) => bg.setMusicVolume(Number(e.target.value))}
                className="w-16 accent-white sm:w-20"
                aria-label="音乐音量"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-white/60">
              <Volume2 className="size-3" /> 背景音
              <input
                type="range"
                min={0}
                max={100}
                value={bg.ambientVolume}
                onChange={(e) => bg.setAmbientVolume(Number(e.target.value))}
                className="w-16 accent-white sm:w-20"
                aria-label="背景音量"
              />
            </label>

            <div className="ml-auto flex flex-wrap items-center gap-1">
              <button
                onClick={onToggleRun}
                title={running ? "暂停" : "继续"}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] text-white/90 transition-colors hover:bg-white/20"
              >
                {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {running ? "暂停" : "继续"}
              </button>
              <button
                onClick={onSkip}
                title="跳过本轮"
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SkipForward className="size-3.5" /> 跳过
              </button>
              <button
                onClick={onReset}
                title="重置计时"
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="size-3.5" /> 重置
              </button>
              <button
                onClick={onEnd}
                disabled={endDisabled}
                title="结束学习"
                className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1.5 text-[11px] text-white/90 transition-colors hover:bg-white/20 disabled:opacity-40"
              >
                <Square className="size-3.5" /> 结束学习
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
