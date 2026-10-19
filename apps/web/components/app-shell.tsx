"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { todayISO } from "@learn-workbench/shared/dates";
import { Toaster } from "@/components/ui/toaster";
import { DesktopNav } from "@/components/shell/desktop-nav";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";
import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { WellbeingFloat } from "@/components/shell/wellbeing-float";
import { WebMotionStyles } from "@/components/shell/motion-styles";
import { useSessionGuard } from "@/components/shell/use-session-guard";

/**
 * 全局应用外壳（编排组件）。
 *
 * 拆分前这里是 470 行的"什么都干"组件；现在只负责组合：
 * - `shell/desktop-nav` 桌面顶栏（含领域胶囊）；
 * - `shell/mobile-top-bar` / `shell/bottom-tab-bar` 移动端顶栏与底部导航；
 * - `shell/motion-styles` 顶栏/页面共享动效样式；
 * - `shell/wellbeing-float` 健康提醒浮层；
 * - `shell/use-session-guard` 会话校验 effect（公开路径放行）。
 *
 * DOM/类名与拆分前保持一致，导出 `{ AppShell }` 不变（路由组迁移无需改动引用）。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  // 客户端挂载后再算日期，避免 SSR 静态快照日期与水合不一致（React #418 同根因）
  const date = mounted ? todayISO() : "";

  useSessionGuard(pathname);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // 登录页与落地页不显示导航与布局外壳（与拆分前完全一致）
  if (pathname === "/login" || pathname === "/") {
    return <>{children}</>;
  }

  return (
    <>
      {/* 顶栏/页面共享动效样式：挂在外壳里，保证**每个**带导航的页面都有（含 reduced-motion 守护） */}
      <WebMotionStyles />

      {/* 桌面端顶导（毛玻璃，5 入口） */}
      <DesktopNav date={date} />

      {/* 移动端顶栏（毛玻璃） */}
      <MobileTopBar date={date} />

      <main className="app-main relative z-0 min-h-screen">
        <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-10">{children}</div>
      </main>

      {/* 移动端底部导航（毛玻璃，5 入口） */}
      <BottomTabBar />

      {/* 健康提醒系统级浮层（wellbeing 收敛，不再占一级导航） */}
      <WellbeingFloat />

      <Toaster />
    </>
  );
}

// 兼容旧引用（页面若从 app-shell 引入动效样式，行为不变）
export { WebMotionStyles } from "@/components/shell/motion-styles";
