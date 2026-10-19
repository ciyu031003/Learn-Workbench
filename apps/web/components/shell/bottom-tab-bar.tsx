"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_TABS, isActivePath } from "@/components/shell/nav-items";

/** 移动端底部导航（毛玻璃，5 入口）—— 从 `components/app-shell.tsx` 原样抽出。 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="surface-nav app-bottomnav fixed inset-x-0 bottom-0 z-30 border-t">
      {BOTTOM_TABS.map((item) => {
        const active = isActivePath(pathname, item.href);
        const jobs = item.href === "/jobs";
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "lwb-tab flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-transform active:scale-[.94]",
              active ? (jobs ? "text-accent" : "text-primary") : "text-muted-foreground"
            )}
          >
            <span className="lwb-tab-icon" data-active={active ? "true" : "false"} data-tone={jobs ? "accent" : "primary"}>
              <item.icon className="lwb-nav-icon size-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
