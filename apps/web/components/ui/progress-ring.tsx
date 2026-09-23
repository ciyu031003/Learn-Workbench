import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { clampPercent, ringStyle } from "@/lib/ui-kit";

/**
 * v13 U2：conic-gradient + mask 圆环（技法参考 uiverse.io/VashonG/jolly-yak-23, MIT）。
 * 相比 SVG 环：无描边接缝、渐变更顺、改值只改 CSS 变量（由 @property --ring-value 过渡）。
 */
/** 不确定进度时露出的弧长（%）：0 值会让整环都是轨道色，转起来看不见 */
const SPIN_ARC_PERCENT = 28;

export function ProgressRing({
  value,
  size = 112,
  thickness = 10,
  from,
  to,
  track,
  spinning,
  className,
  children,
  label,
}: {
  value: number;
  size?: number;
  thickness?: number;
  from?: string;
  to?: string;
  track?: string;
  /** 不确定进度（加载中）：整环匀速旋转 */
  spinning?: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const shown = spinning ? Math.max(clampPercent(value), SPIN_ARC_PERCENT) : clampPercent(value);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("ring-conic shrink-0", spinning && "ring-conic-spin", className)}
      style={{ ...(ringStyle({ value: shown, thickness, from, to, track }) as CSSProperties), width: size, height: size }}
    >
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div> : null}
    </div>
  );
}
