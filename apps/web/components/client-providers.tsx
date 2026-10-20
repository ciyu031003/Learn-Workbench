"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * 根布局里的"运行时附加件"（S8-b）。
 *
 * 首屏绘制前，主题已经由 app/layout.tsx 的内联脚本按 localStorage 预置好 html.dark；
 * ThemeProvider 只是"挂载后保持同步"的增强项，不必进首载 JS。
 *
 * 为什么不用 next/dynamic：App Router 会把 next/dynamic 的 chunk 作为客户端引用
 * **预载进首载**（route-bundle-stats 里可见），起不到减首载的作用。这里改用
 * useEffect 里的**运行时 import()**：chunk 只有空闲回调触发后才请求，不进首载统计，
 * 也不与 LCP 抢带宽。挂载前 html.dark 由内联脚本兜底，行为一致。
 */
type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function ClientProviders() {
  const [ThemeProvider, setThemeProvider] = useState<ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    const idleWindow = window as IdleWindow;
    const load = () => {
      void import("./theme-provider").then((mod) => {
        if (alive) setThemeProvider(() => mod.ThemeProvider);
      }).catch(() => {
        // 主题同步是增强项：加载失败时保留内联脚本预置的主题即可
      });
    };

    let handle: number | undefined;
    if (typeof idleWindow.requestIdleCallback === "function") {
      handle = idleWindow.requestIdleCallback(load, { timeout: 2000 });
    } else {
      handle = window.setTimeout(load, 800);
    }

    return () => {
      alive = false;
      if (handle === undefined) return;
      if (typeof idleWindow.cancelIdleCallback === "function") idleWindow.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return ThemeProvider ? <ThemeProvider /> : null;
}
