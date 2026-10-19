"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 页面数据块的统一三态（+ ready）：loading / empty / error / ready */
export type SectionStatus = "loading" | "empty" | "error" | "ready";

/** 状态对应的 ARIA role：加载/空态是 status（aria-live=polite），错误是 alert（立即播报） */
export function sectionRole(status: SectionStatus): "status" | "alert" | undefined {
  if (status === "error") return "alert";
  if (status === "loading" || status === "empty") return "status";
  return undefined;
}

/** loading 时给容器打 aria-busy，避免读屏重复播报骨架屏 */
export function sectionAriaBusy(status: SectionStatus): boolean | undefined {
  return status === "loading" ? true : undefined;
}

/** 是否展示重试按钮：只有 error（有 onRetry 时）和 empty（可选）需要可操作入口 */
export function canRetry(status: SectionStatus, hasRetryHandler: boolean, retryOnEmpty = false): boolean {
  if (!hasRetryHandler) return false;
  if (status === "error") return true;
  return retryOnEmpty && status === "empty";
}

export interface AsyncSectionProps {
  status: SectionStatus;
  onRetry?: () => void;
  /** 错误态文案（默认「加载失败，请稍后重试」） */
  errorMessage?: ReactNode;
  /** 空态内容（默认「暂无数据」） */
  empty?: ReactNode;
  /** loading 骨架行数（默认 3） */
  skeletonRows?: number;
  /** loading 时给读屏的文案 */
  loadingLabel?: string;
  retryLabel?: string;
  /** 空态是否也显示「重试」（默认 false） */
  retryOnEmpty?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * 数据块三态容器（S6-1）。
 *
 * - loading：骨架屏 + role="status" aria-busy（不闪白、不播报噪音）
 * - error：role="alert" + 「加载失败 + 重试」
 * - empty：role="status" + 空态插槽
 * - ready：渲染 children
 *
 * 页面只需要把请求状态映射进来，不再各写一套 if/else。
 */
export function AsyncSection({
  status,
  onRetry,
  errorMessage,
  empty,
  skeletonRows = 3,
  loadingLabel = "加载中…",
  retryLabel = "重试",
  retryOnEmpty = false,
  className,
  children,
}: AsyncSectionProps) {
  if (status === "ready") return <>{children}</>;

  if (status === "loading") {
    return (
      <div role={sectionRole(status)} aria-busy={sectionAriaBusy(status)} aria-live="polite" className={cn("flex flex-col gap-2", className)}>
        <span className="sr-only">{loadingLabel}</span>
        {Array.from({ length: Math.max(1, skeletonRows) }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            className="h-12 animate-pulse rounded-xl border border-border/40 bg-muted/40"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role={sectionRole(status)} aria-live="assertive" className={cn("flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-6 text-center", className)}>
        <p className="text-sm font-medium text-danger">{errorMessage ?? "加载失败，请稍后重试"}</p>
        {canRetry(status, !!onRetry) ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  // empty
  return (
    <div role={sectionRole(status)} aria-live="polite" className={cn("flex flex-col items-center gap-3 rounded-xl px-4 py-8 text-center", className)}>
      <div className="text-sm text-muted-foreground">{empty ?? "暂无数据"}</div>
      {canRetry(status, !!onRetry, retryOnEmpty) ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
