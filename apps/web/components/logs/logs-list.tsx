"use client";

import type { ReactNode } from "react";
import type { LogEntry } from "@learn-workbench/shared/schemas";
import { logKindLabels } from "@learn-workbench/shared/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useWindowedList } from "@/lib/use-windowed-list";
import { windowLabel } from "@/lib/windowed-list";

/**
 * 学习日志列表（S3-8）——windows 化 + content-visibility。
 *
 * 现状问题：`/api/logs?limit=200` 一次拉 200 条并全量渲染，长正文日志在移动端滚动掉帧。
 * 这里改为「首屏 20 条 + 加载更多」，屏幕外卡片用 content-visibility 跳过绘制，
 * 同时保留原卡片视觉/入场动画顺序，可直接替换页面里的 `shown.map(...)` 区块。
 */

export const LOG_LIST_BATCH = 20;

const KIND_VARIANT: Record<string, "default" | "accent" | "success" | "muted"> = {
  feynman: "default",
  review: "accent",
  project: "success",
  interview: "muted",
};

export function LogsList({
  entries,
  batch = LOG_LIST_BATCH,
  empty,
  resetKey,
  onLoadMore,
}: {
  /** 已按筛选条件过滤后的日志（父级负责筛选） */
  entries: LogEntry[];
  /** 每批条数，默认 20 */
  batch?: number;
  /** 空态（父级传自己的 EmptyState 卡片，保持文案/操作不变） */
  empty?: ReactNode;
  /** 筛选条件变化时重置回第一页（传 filter 值即可） */
  resetKey?: string | number;
  /** 可选：加载更多时顺带拉下一页数据（当前数据来自 limit=200 的全量，可先不传） */
  onLoadMore?: () => void;
}) {
  const { visible, shown, total, hasMore, loadMore } = useWindowedList(entries, { batch, resetKey });

  if (total === 0) return <>{empty ?? null}</>;

  return (
    <div className="flex flex-col gap-3">
      {visible.map((entry, index) => (
        <div
          key={entry.id}
          // 屏幕外卡片跳过布局/绘制；预留高度避免滚动条抖动
          style={{ contentVisibility: "auto", containIntrinsicSize: "auto 12rem" }}
        >
          <Card style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }} className="rise-in lift">
            <CardContent className="p-5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Badge variant={KIND_VARIANT[entry.kind] ?? "default"}>{logKindLabels[entry.kind] ?? entry.kind}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </span>
              </div>
              <h3 className="text-base font-semibold transition-colors group-hover:text-primary">{entry.title}</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{entry.content}</p>
            </CardContent>
          </Card>
        </div>
      ))}

      <div className="flex flex-col items-center gap-2 py-2">
        <p className="text-center text-xs text-muted-foreground">{windowLabel(shown, total, "篇")}</p>
        {hasMore ? (
          <button
            type="button"
            onClick={() => {
              onLoadMore?.();
              loadMore();
            }}
            className="rounded-lg border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            加载更多（每次 {batch} 篇）
          </button>
        ) : null}
      </div>
    </div>
  );
}
