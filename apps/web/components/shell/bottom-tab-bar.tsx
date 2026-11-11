"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_TABS, isActivePath } from "@/components/shell/nav-items";

/** 移动端底部导航（毛玻璃，5 入口）—— 从 `components/app-shell.tsx` 原样抽出。 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="surface-nav app-bottomnav fixed z-30" aria-label="主导航">
      {BOTTOM_TABS.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "lwb-tab flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium outline-none transition-transform active:scale-[.94] focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <span className="lwb-tab-icon" data-active={active ? "true" : "false"} data-tone="primary">
              <item.icon className="lwb-nav-icon size-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
