"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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
import { Toaster } from "@/components/ui/toaster";

const nav = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/roadmap", label: "路线图", icon: Map },
  { href: "/tasks", label: "任务", icon: ListTodo },
  { href: "/logs", label: "日志", icon: NotebookPen },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const date = todayISO();

  // 会话有效性校验：伪造/过期 cookie 会被 /api/auth/me 识别并踢回登录页
  useEffect(() => {
    if (pathname === "/login") return;
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (!d?.user) {
          router.replace(`/login?from=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  // 登录页不显示导航与布局外壳
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      {/* 桌面端侧边栏（毛玻璃） */}
      <aside className="glass-nav app-sidebar fixed inset-y-0 left-0 z-30 w-72 flex-col border-r px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span>
            <span className="block text-base font-semibold leading-tight text-foreground">学习工作台</span>
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
                  "flex items-center gap-3.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-500/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-2 text-xs text-muted-foreground">今日 {date}</div>
      </aside>

      {/* 移动端顶栏（毛玻璃） */}
      <header className="glass-nav app-mobile-topbar sticky top-0 z-30 h-14 items-center justify-between border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">学习工作台</span>
        </Link>
        <span className="text-xs text-muted-foreground">{date}</span>
      </header>

      <main className="app-main relative z-0 min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">{children}</div>
      </main>

      {/* 移动端底部导航（毛玻璃） */}
      <nav className="glass-nav app-bottomnav fixed inset-x-0 bottom-0 z-30 grid-cols-5 border-t">
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

      <Toaster />
    </>
  );
}