"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map,
  ListTodo,
  NotebookPen,
  Settings,
  Sparkles,
  HeartPulse,
  Flower,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { todayISO } from "@learn-workbench/shared";
import { Toaster } from "@/components/ui/toaster";

const nav = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/roadmap", label: "路线图", icon: Map },
  { href: "/tasks", label: "任务", icon: ListTodo },
  { href: "/logs", label: "日志", icon: NotebookPen },
  { href: "/wellbeing", label: "健康", icon: HeartPulse },
  { href: "/jobs", label: "招花", icon: Flower },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const date = todayISO();
  const [careerInfo, setCareerInfo] = useState<{ name: string; percent: number } | null>(null);

  // 侧边栏底部：当前职业 + 整体进度
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/settings/career").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([, s]) => {
      if (!alive) return;
      const summary = s as { careerName?: string; overallPercent?: number } | null;
      setCareerInfo({ name: summary?.careerName ?? "ICT 学习规划", percent: summary?.overallPercent ?? 0 });
    });
    return () => {
      alive = false;
    };
  }, []);

  // 会话有效性校验：伪造/过期 cookie 会被 /api/auth/me 识别
  // 无效会话先调用 logout 清除失效 cookie，避免 proxy 把 /login 弹回 /dashboard 造成“点击即回仪表盘”循环
  useEffect(() => {
    if (pathname === "/login") return;
    let alive = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return { __error: true }; // 服务异常（500/网络）不视为未登录，避免误踢
        return r.json();
      })
      .then(async (d: { __error?: boolean; user?: unknown } | null) => {
        if (!alive || !d || d.__error) return;
        if (!d.user) {
          try {
            await fetch("/api/auth/logout", { method: "POST" });
          } catch {}
          if (!alive) return;
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
            const isJobs = item.href === "/jobs";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? isJobs
                      ? "bg-emerald-500/10 text-foreground"
                      : "bg-indigo-500/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                {active ? (
                  <span className={cn("absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b", isJobs ? "from-emerald-400 to-cyan-500" : "from-primary to-accent")} />
                ) : null}
                <item.icon className={cn("size-4.5", active && (isJobs ? "text-emerald-500" : "text-primary"))} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2.5">
          {careerInfo ? (
            <div className="glass flex items-center justify-between rounded-xl px-3 py-2.5">
              <span className="truncate text-xs font-medium text-foreground">{careerInfo.name}</span>
              <span className="ml-2 shrink-0 text-[11px] tabular-nums text-muted-foreground">{careerInfo.percent}%</span>
            </div>
          ) : null}
          <div className="px-1 text-xs text-muted-foreground">今日 {date}</div>
        </div>
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
      <nav className="glass-nav app-bottomnav fixed inset-x-0 bottom-0 z-30 border-t">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const isJobs = item.href === "/jobs";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? (isJobs ? "text-emerald-500" : "text-primary") : "text-muted-foreground"
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