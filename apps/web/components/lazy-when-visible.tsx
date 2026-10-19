"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { shouldMountImmediately, normalizeRootMargin } from "@/lib/lazy-visibility";

/**
 * 视口懒加载容器（S3-6）。
 *
 * - 用 IntersectionObserver 等到真正接近视口（默认 rootMargin 200px）再挂载 children；
 * - SSR/无 IntersectionObserver 环境下首帧渲染 fallback，挂载后立即放行，避免 hydration 不一致；
 * - children 一旦挂载默认不再卸载（`once`），避免滚动抖动导致 3D 反复初始化。
 */
export interface LazyWhenVisibleProps {
  children: ReactNode;
  /** 未进入视口时的占位（建议与 children 同尺寸，避免 CLS） */
  fallback?: ReactNode;
  /** 提前触发距离，默认 200px */
  rootMargin?: string;
  /** 首帧后的兜底等待：IO 迟迟不回调（隐藏标签页/无布局）时按恢复显示处理 */
  className?: string;
  /** 进入一次后不再卸载（默认 true） */
  once?: boolean;
  /** 强制立即渲染（父级已知无需懒加载） */
  disabled?: boolean;
}

const EMPTY_FALLBACK = null;

export function LazyWhenVisible({
  children,
  fallback = EMPTY_FALLBACK,
  rootMargin = "200px 0px",
  className,
  once = true,
  disabled = false,
}: LazyWhenVisibleProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const mountImmediately = shouldMountImmediately({ disabled });
  const observerRootMargin = normalizeRootMargin(rootMargin);

  useEffect(() => {
    if (mountImmediately) return;
    const host = hostRef.current;
    if (!host) return;

    if (typeof IntersectionObserver === "undefined") {
      // 老浏览器：下一帧放行（异步 setState，避免 effect 内同步 setState 触发级联渲染）
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);
        if (intersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { rootMargin: observerRootMargin }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [mountImmediately, once, observerRootMargin]);

  const showChildren = mountImmediately || visible;

  return (
    <div ref={hostRef} className={className} data-lazy-visible={showChildren ? "true" : "false"}>
      {showChildren ? children : fallback}
    </div>
  );
}
