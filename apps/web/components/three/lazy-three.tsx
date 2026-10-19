"use client";

import dynamic from "next/dynamic";
import { useMemo, useSyncExternalStore } from "react";
import { LazyWhenVisible } from "@/components/lazy-when-visible";
import { Skeleton } from "@/components/ui/skeleton";
import { readNavigatorHints, shouldDegrade3d } from "@/lib/device-capability";

/**
 * three.js 组件的统一懒加载外壳（S3-6）。
 *
 * 三层策略：
 *  1. **未挂载**（SSR / hydration 前）：渲染同尺寸静态占位，保证 HTML 与水合后首帧一致；
 *  2. **低端设备**（`shouldDegrade3d`：≤4 核 / ≤2GB / saveData）：永久使用静态 CSS 回退，
 *     连 184 KB(gz) 的 three chunk 都不请求；
 *  3. **正常设备**：进入视口（rootMargin 200px）后才 `dynamic(ssr:false)` 拉取 three chunk。
 *
 * 静态回退直接复用 3D 组件自身的 CSS 视觉（渐变球 / 玻璃杯），用户只感知为"静态版"。
 */

const EMPTY_SUBSCRIBE = () => () => {};

/** 挂载检测：SSR false / 客户端 true，避免 hydration 不一致（同 ui/modal.tsx 的写法） */
function useMounted(): boolean {
  return useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false
  );
}

const StateOrb3d = dynamic(() => import("@/components/three/state-orb").then((m) => m.StateOrb), {
  ssr: false,
  loading: () => <Skeleton className="size-full" rounded="rounded-full" />,
});

const WaterGlass3d = dynamic(() => import("@/components/three/water-glass-3d").then((m) => m.WaterGlass3D), {
  ssr: false,
  loading: () => <Skeleton className="size-full" rounded="rounded-2xl" />,
});

/** 与 state-orb.tsx 的 CSS 回落同款视觉（只是不再叠加 canvas） */
function StaticStateOrb({ score, size = 220, className }: { score: number; size?: number; className?: string }) {
  const mix = Math.max(0, Math.min(1, score / 100));
  const color = `hsl(${Math.round(28 + mix * 118)} 62% 52%)`;
  return (
    <div
      className={className}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden
      data-three-fallback="static"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${color}, transparent 62%), radial-gradient(circle at 68% 74%, rgba(255,255,255,0.35), transparent 55%)`,
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}

/** 与 water-glass-3d.tsx 的 CSS 回落同款视觉 */
function StaticWaterGlass({ ratio, size = 176, className }: { ratio: number; size?: number; className?: string }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <div
      className={className}
      style={{ width: size, height: size * 1.25, position: "relative" }}
      aria-hidden
      data-three-fallback="static"
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-b-[26px] rounded-t-[14px]"
        style={{
          border: "1px solid rgba(255,255,255,0.35)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(47,179,166,0.12))",
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${Math.round(clamped * 100)}%`, background: "linear-gradient(180deg, #57c7b2, #2fb3a6)" }}
        />
      </div>
    </div>
  );
}

export function LazyStateOrb({ score, size = 220, className }: { score: number; size?: number; className?: string }) {
  const mounted = useMounted();
  const degraded = useMemo(() => (mounted ? shouldDegrade3d(readNavigatorHints()) : false), [mounted]);

  if (!mounted || degraded) return <StaticStateOrb score={score} size={size} className={className} />;

  return (
    <LazyWhenVisible
      fallback={<StaticStateOrb score={score} size={size} className={className} />}
      className="inline-flex"
    >
      <StateOrb3d score={score} size={size} className={className} />
    </LazyWhenVisible>
  );
}

export function LazyWaterGlass3D({ ratio, size = 176, className }: { ratio: number; size?: number; className?: string }) {
  const mounted = useMounted();
  const degraded = useMemo(() => (mounted ? shouldDegrade3d(readNavigatorHints()) : false), [mounted]);

  if (!mounted || degraded) return <StaticWaterGlass ratio={ratio} size={size} className={className} />;

  return (
    <LazyWhenVisible
      fallback={<StaticWaterGlass ratio={ratio} size={size} className={className} />}
      className="inline-flex"
    >
      <WaterGlass3d ratio={ratio} size={size} className={className} />
    </LazyWhenVisible>
  );
}
