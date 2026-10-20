"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

/**
 * 闪光卡懒加载壳（S8-b 改造）。
 *
 * 原实现用 next/dynamic：App Router 会把该 chunk 作为客户端引用预载进路由首载
 * （分享页因此多背 ~5.5KB gz 的卡面模块），与注释里"只在真正展开时才下载"的意图相反。
 * 现在改为：静态 import 一个空壳 → IntersectionObserver 进入视口（300px 预取）后
 * 运行时 import("./holo-sport-card")，chunk 不进首载统计，three 仍由卡片内部再懒加载。
 */
type HoloCardProps = {
  model: import("@learn-workbench/shared/types").SportsCardModel;
  base?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
};

const PLACEHOLDER = (
  <div className="grid h-[420px] place-items-center rounded-[24px] bg-white text-xs text-muted-foreground shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)] sm:h-[540px]">
    正在唤醒镭射卡…
  </div>
);

export function HoloSportCardLazy(props: HoloCardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [Card, setCard] = useState<ComponentType<HoloCardProps> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void import("./holo-sport-card")
        .then((mod) => {
          if (alive) setCard(() => mod.default as ComponentType<HoloCardProps>);
        })
        .catch(() => {
          // 加载失败保留占位，不白屏
        });
    };

    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        alive = false;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(host);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, []);

  return <div ref={hostRef}>{Card ? <Card {...props} /> : PLACEHOLDER}</div>;
}
