import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * 页面头部（BoardUI 层级）：eyebrow（可选）→ 标题 → 说明 → 右侧操作。
 *
 * 统一 career / market 等业务页的标题节奏：
 * - 标题走复合字号 text-title-1-semibold（移动端 24 / 大屏 32）；
 * - 说明走 text-body-medium + text-text-secondary；
 * - 操作用 flex-wrap，窄屏自然换行到标题下方。
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** 标题上方的小标签行（图标块、Badge 等）。 */
  eyebrow?: ReactNode;
  /** 标题左侧的图标块；与 eyebrow 二选一。 */
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
        <div className="flex items-center gap-3">
          {icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border-button-default bg-background-secondary-default text-foreground-icon-primary">
              {icon}
            </span>
          ) : null}
          <h1 className="text-title-1-semibold text-text-primary sm:text-display-4-medium">{title}</h1>
        </div>
        {description ? (
          <p className="mt-1.5 text-body-medium text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
