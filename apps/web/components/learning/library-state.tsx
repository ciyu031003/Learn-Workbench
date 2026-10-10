"use client";

import { useCallback, useEffect, useState } from "react";
import type { LearningLibraryState } from "@learn-workbench/shared";
import { CheckCircle2, Copy, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type LibraryStateStatus = "loading" | "ready" | "anon";

export interface LibraryStateView {
  status: LibraryStateStatus;
  /** pointKey → 阅读进度（0-100） */
  read: Map<string, number>;
  favorites: Set<string>;
  counts: { read: number; favorites: number; readThisWeek: number };
}

const EMPTY_COUNTS = { read: 0, favorites: 0, readThisWeek: 0 };

/**
 * 读取跨设备阅读状态（组二 · 阶段 8）。
 * 未登录/失败一律退回 "anon" —— 页面不因为"没登录"或后端抖动而报错或清空。
 */
export function useLibraryState(trackSlug?: string): LibraryStateView {
  const [view, setView] = useState<LibraryStateView>({
    status: "loading",
    read: new Map(),
    favorites: new Set(),
    counts: EMPTY_COUNTS,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const query = trackSlug ? `?track=${encodeURIComponent(trackSlug)}` : "";
        const response = await fetch(`/api/learning/library-state${query}`);
        if (!response.ok) {
          if (alive) setView((current) => ({ ...current, status: "anon" }));
          return;
        }
        const data = (await response.json()) as LearningLibraryState;
        if (!alive) return;
        setView({
          status: "ready",
          read: new Map(data.read.map((item) => [item.pointKey, item.progress])),
          favorites: new Set(data.favorites.map((item) => item.pointKey)),
          counts: data.counts ?? EMPTY_COUNTS,
        });
      } catch {
        if (alive) setView((current) => ({ ...current, status: "anon" }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [trackSlug]);

  return view;
}

/** 已读/阅读中标记；未登录时不显示（不假装用户读过） */
export function ReadBadge({ progress, className }: { progress: number | undefined; className?: string }) {
  if (progress === undefined || progress <= 0) return null;
  const done = progress >= 85;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-medium",
        done ? "text-success-strong" : "text-muted-foreground",
        className
      )}
    >
      <CheckCircle2 className={cn("size-3", done ? "text-success" : "text-muted-foreground")} />
      {done ? "已读" : `读到 ${progress}%`}
    </span>
  );
}

export function FavoriteMark({ className }: { className?: string }) {
  return <Star className={cn("size-3.5 shrink-0 text-warning", className)} aria-label="已收藏" />;
}

/** 代码块复制按钮：复制成功给 1.6s 的"已复制"反馈；失败退化为提示手动选择 */
export function CodeCopyButton({ code, className }: { code: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
  }, [code]);

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      aria-label="复制代码"
    >
      <Copy className="size-3.5" />
      {state === "copied" ? "已复制" : state === "failed" ? "复制失败，请手动选择" : "复制"}
    </button>
  );
}
