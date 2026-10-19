import { cn } from "@/lib/utils";

/**
 * 登录区路由骨架（S6-2）：纯 CSS 动画（Tailwind animate-pulse），不引新依赖。
 * 尊重 prefers-reduced-motion（motion-reduce:animate-none），避免前庭敏感用户看到闪烁。
 *
 * 结构对齐 dashboard / today 的首屏：问候条 → 2 张快捷卡 → 统计 4 格 → 列表 3 行。
 */
export function PageSkeleton({ variant = "dashboard" }: { variant?: "dashboard" | "today" | "default" }) {
  const rows = variant === "today" ? 4 : 3;
  return (
    <div
      className="page-enter flex flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-label="页面加载中"
      data-testid="page-skeleton"
    >
      <div className="flex flex-col gap-3">
        <div className="h-4 w-28 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <div className="h-8 w-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="paper-card h-20 animate-pulse rounded-2xl bg-muted/60 motion-reduce:animate-none" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="paper-card h-24 animate-pulse rounded-2xl bg-muted/50 motion-reduce:animate-none" />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={cn(
              "paper-card h-16 animate-pulse rounded-2xl bg-muted/40 motion-reduce:animate-none",
              i > 0 && "opacity-90"
            )}
          />
        ))}
      </div>
    </div>
  );
}
