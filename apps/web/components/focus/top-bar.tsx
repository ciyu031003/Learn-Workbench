"use client";

import { Maximize, Minimize, Palette, X } from "lucide-react";

/** 全屏弹层顶栏：全屏切换 / 背景面板开关 / 关闭。S8-a 从 focus-timer.tsx 原样搬出。 */
export function FocusTopBar({
  full,
  onToggleFullscreen,
  onToggleBackground,
  onClose,
}: {
  full: boolean;
  onToggleFullscreen: () => void;
  onToggleBackground: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative z-10 flex items-center justify-between px-4 pt-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFullscreen}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/20"
        >
          {full ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
          {full ? "退出全屏 (Esc)" : "进入全屏"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleBackground}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/20"
        >
          <Palette className="size-3.5" /> 背景
        </button>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 backdrop-blur-md transition-all hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
