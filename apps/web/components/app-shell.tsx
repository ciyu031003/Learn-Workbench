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
      {/* 桌面端侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-white/60 px-5 py-6 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span>
            <span className="block text-base font-semibold leading-tight">ICT 学习工作台</span>
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="rounded-xl bg-muted/70 px-3 py-2.5 text-xs text-muted-foreground">
          今日 {date}
        </div>
      </aside>

      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-white/70 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold">ICT 学习工作台</span>
        </Link>
        <span className="text-xs text-muted-foreground">{date}</span>
      </header>

      <main className="relative z-0 min-h-screen pb-20 lg:pb-6 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* 移动端底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/60 bg-white/80 backdrop-blur-xl lg:hidden">
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
