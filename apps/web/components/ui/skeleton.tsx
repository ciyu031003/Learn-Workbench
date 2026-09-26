import { cn } from "@/lib/utils";

/** v13 U1：统一骨架块（技法参考 uiverse.io/Praashoo7/stale-bat-2, MIT）——斜切扫光，不用位图。 */
export function Skeleton({ className, rounded = "rounded-xl" }: { className?: string; rounded?: string }) {
  return <div aria-hidden className={cn("shimmer", rounded, className)} />;
}

/** 多行文本骨架：最后一行短一截，读起来更像"正在加载的文字"。 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} rounded="rounded-full" />
      ))}
    </div>
  );
}

/** 卡片骨架：标题 + 若干行 + 可选底部按钮条。 */
export function SkeletonCard({ lines = 3, className, withAction }: { lines?: number; className?: string; withAction?: boolean }) {
  return (
    <div className={cn("paper-card edge-light p-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" rounded="rounded-full" />
        <Skeleton className="h-4 w-28" rounded="rounded-full" />
      </div>
      <SkeletonText lines={lines} className="mt-4" />
      {withAction ? <Skeleton className="mt-4 h-9 w-28" rounded="rounded-full" /> : null}
    </div>
  );
}

/** 列表骨架：N 行等高铁行，用于招花/任务/图鉴列表首屏。 */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="paper-card flex items-center gap-3 p-3.5">
          <Skeleton className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/2" rounded="rounded-full" />
            <Skeleton className="mt-2 h-3 w-1/3" rounded="rounded-full" />
          </div>
          <Skeleton className="h-8 w-16" rounded="rounded-full" />
        </div>
      ))}
    </div>
  );
}
