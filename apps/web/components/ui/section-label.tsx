import type { ReactNode } from "react";

/**
 * 分组小标题（v8 P2）：与 APP「我的」页的 GroupLabel 同一套视觉语言，
 * 用来把平铺的 Card 收进「账号 / 学习与数据 / 外观与体验 / 支持」等分组。
 */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 px-1">
      {/* v1.28：小标题前加一道主色渐变竖条，和三线细轨同一套语言 */}
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <span aria-hidden className="h-3 w-[3px] shrink-0 rounded-full bg-[image:var(--grad-line)]" />
        {children}
      </h2>
      {right}
    </div>
  );
}
