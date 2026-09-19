"use client";

/**
 * 闪光卡懒加载壳：three.js 与其后处理只在真正展开卡片时才下载（异步 chunk），
 * 不进入运动档案页首包 —— 与 v8 的 3D 约定一致。
 */
import dynamic from "next/dynamic";

export const HoloSportCardLazy = dynamic(() => import("./holo-sport-card"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-[24px] bg-white text-xs text-muted-foreground shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)] sm:h-[540px]">
      正在唤醒镭射卡…
    </div>
  ),
});
