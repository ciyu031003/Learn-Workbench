"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  ListTodo,
  NotebookPen,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { todayISO } from "@learn-workbench/shared";

const nav = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/roadmap", label: "路线图", icon: Map },
  { href: "/tasks", label: "任务", icon: ListTodo },
  { href: "/logs", label: "日志", icon: NotebookPen },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const date = todayISO();

  return (
    <>
      {/* 桌面端侧边栏（毛玻璃） */}
      <aside className="glass-nav fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r px-5 py-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_6px_18px_rgba(232,147,12,0.4)]">
            <Sparkles className="size-5" />
          </span>
          <span>
            <span className="block text-base font-semibold leading-tight text-foreground">ICT 学习工作台</span>
            <span className="block text-xs text-muted-foreground">路线 · 规划 · 输出</span>
          </span>
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary/25 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                    : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="rounded-xl border border-white/20 bg-white/12 px-3 py-2.5 text-xs text-muted-foreground backdrop-blur-md">
          今日 {date}
        </div>
      </aside>

      {/* 移动端顶栏（毛玻璃） */}
      <header className="glass-nav sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">ICT 学习工作台</span>
        </Link>
        <span className="text-xs text-muted-foreground">{date}</span>
      </header>

      <main className="relative z-0 min-h-screen pb-20 lg:pb-6 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* 移动端底部导航（毛玻璃） */}
      <nav className="glass-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t lg:hidden">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
