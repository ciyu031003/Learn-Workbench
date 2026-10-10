"use client";

import { useEffect, useState } from "react";
import type { LearningProgress } from "@learn-workbench/shared";
import { cn } from "@/lib/utils";

type State = "loading" | "ready" | "anon";

/**
 * 掌握度小组件：读 `/api/learning/progress`（需登录）。
 *
 * 掌握度口径为 `加权正确率 × (0.6 + 0.4 × 时间新鲜度)`，与移动端同一实现
 * （@learn-workbench/shared 的 LEARNING_MASTERY）；这里把口径写在界面上，
 * 避免再把"浏览过"当成"掌握"。
 */
export function LearningMastery({ trackSlug, className }: { trackSlug?: string; className?: string }) {
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const query = trackSlug ? `?track=${encodeURIComponent(trackSlug)}` : "";
        const response = await fetch(`/api/learning/progress${query}`);
        if (!response.ok) {
          if (alive) setState("anon");
          return;
        }
        const data = (await response.json()) as LearningProgress;
        if (alive) {
          setProgress(data);
          setState("ready");
        }
      } catch {
        if (alive) setState("anon");
      }
    })();
    return () => {
      alive = false;
    };
  }, [trackSlug]);

  if (state === "loading") {
    return (
      <span className={cn("inline-flex h-6 w-24 animate-pulse rounded-full bg-muted", className)} aria-hidden />
    );
  }

  if (state === "anon" || !progress) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>登录后统计掌握度</span>
    );
  }

  return (
    <span className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className="text-sm font-semibold text-foreground">掌握度 {progress.mastery}%</span>
      <span className="text-xs text-muted-foreground">
        练过 {progress.attempted} 题 · 近 5 次加权正确率 × 时间新鲜度
      </span>
    </span>
  );
}
