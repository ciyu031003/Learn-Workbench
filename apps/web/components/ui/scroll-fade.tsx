"use client";

import { useState, type ReactNode, type UIEvent } from "react";
import { cx } from "@/utils/cx";

/**
 * 内部纵向滚动区的柔和上缘（BoardUI scroll-fade 规则的精简实现）：
 * 卡片头部留在滚动区外；滚动后顶部叠加 1px / 4px 两级遮罩模糊 + 表面渐隐，
 * 避免内容被硬切。未滚动时不显示，不加过渡动效。
 */
export function ScrollFade({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [fade, setFade] = useState(0);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    // 前 24px 滚动内把三层遮罩的透明度从 0 拉满；0 处完全不可见。
    setFade(Math.min(1, Math.max(0, event.currentTarget.scrollTop / 24)));
  };

  return (
    <div className={cx("relative min-h-0 overflow-hidden", className)}>
      <div className="h-full overflow-y-auto overscroll-contain" onScroll={onScroll}>
        {children}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-6">
        <div
          style={{ opacity: fade }}
          className="absolute inset-x-0 top-0 h-6 bg-background-secondary-default/90 backdrop-blur-[1px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          style={{ opacity: fade }}
          className="absolute inset-x-0 top-0 h-4 bg-background-secondary-default/80 backdrop-blur-[4px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          style={{ opacity: fade }}
          className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background-secondary-default to-transparent"
        />
      </div>
    </div>
  );
}
