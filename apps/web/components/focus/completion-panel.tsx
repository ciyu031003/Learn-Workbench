"use client";

import { Coffee, Droplets, Footprints, TreePine } from "lucide-react";
import { FocusStatsCard } from "@/components/focus-stats-card";
import { fmtClock } from "./format";

/** 完成/休息页（休息一下 + 统计 + 再来一次/返回）。S8-a 从 focus-timer.tsx 原样搬出。 */
export function CompletionPanel({
  mode,
  phase,
  elapsedSeconds,
  wbDone,
  onRecordBreak,
  onRecordWater,
  onGoEnergy,
  onAgain,
  onBack,
}: {
  mode: "focus" | "exercise";
  phase: "idle" | "running" | "paused" | "break" | "finished";
  elapsedSeconds: number;
  wbDone: { break?: boolean; water?: boolean };
  onRecordBreak: () => void;
  onRecordWater: () => void;
  onGoEnergy: () => void;
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6 pt-4">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
        <p className="text-2xl font-bold text-white drop-shadow">{phase === "break" ? "休息中 · 本次已记录" : mode === "exercise" ? "运动完成" : "专注完成"}！</p>
        <p className="text-sm text-white/70">本次{mode === "exercise" ? "运动" : "专注"} {fmtClock(elapsedSeconds)}，已自动记录</p>
        <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/20 px-4 py-2 text-sm text-white backdrop-blur-md">
          <TreePine className="size-4 text-success" />
          <span className="font-semibold">专注果实 +{Math.max(1, Math.min(180, Math.round(elapsedSeconds / 60)))}</span>
        </div>

        {/* 休息一下：站立 + 喝水 + 远眺 */}
        <div className="glass w-full max-w-md rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Coffee className="size-4 text-success" /> 休息一下再继续
          </div>
          <p className="mt-1 text-xs text-white/70">站立 + 喝水 + 远眺 5 分钟，让注意力回血</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onRecordBreak}
              disabled={wbDone.break}
              className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-md transition-all hover:bg-white/25 disabled:opacity-60"
            >
              <Footprints className="size-3.5" /> {wbDone.break ? "已记录休息" : "记录休息"}
            </button>
            <button
              onClick={onRecordWater}
              disabled={wbDone.water}
              className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-md transition-all hover:bg-white/25 disabled:opacity-60"
            >
              <Droplets className="size-3.5" /> {wbDone.water ? "已喝水 +250ml" : "喝水 +250ml"}
            </button>
            <button
              onClick={onGoEnergy}
              className="rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/25"
            >
              去记录精力
            </button>
          </div>
        </div>

        <FocusStatsCard />
        <div className="flex gap-3">
          <button
            onClick={onAgain}
            className="rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/25"
          >
            再来一次
          </button>
          <button
            onClick={onBack}
            className="rounded-full bg-gradient-to-b from-primary to-primary-strong px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-105"
          >
            返回任务页
          </button>
        </div>
      </div>
    </div>
  );
}
