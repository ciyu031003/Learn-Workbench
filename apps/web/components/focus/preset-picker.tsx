"use client";

import { cn } from "@/lib/utils";
import { PRESETS } from "./format";

/** 时长快速选择（预设 + 自定义分钟）。返回 Fragment：外层容器由调用方提供，保证 DOM 与拆分前一致。 */
export function PresetPicker({ minutes, onPick }: { minutes: number; onPick: (m: number) => void }) {
  return (
    <>
      {PRESETS.map((m) => (
        <button
          key={m}
          onClick={() => onPick(m)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm backdrop-blur-md transition-all",
            minutes === m
              ? "border-primary/60 bg-primary/30 text-white"
              : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
          )}
        >
          {m} 分钟
        </button>
      ))}
      <label className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur-md">
        <input
          type="number"
          min={1}
          max={180}
          value={minutes}
          onChange={(e) => {
            const v = Math.min(180, Math.max(1, Number(e.target.value) || 1));
            onPick(v);
          }}
          className="w-10 bg-transparent text-center text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        />
        <span className="text-xs text-white/60">分</span>
      </label>
    </>
  );
}
