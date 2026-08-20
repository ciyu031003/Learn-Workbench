"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Map,
  ListTodo,
  NotebookPen,
  Settings,
  Sparkles,
  Flower,
  Rocket,
  ChevronDown,
  GraduationCap,
  Users,
  FileText,
  MessageSquare,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { todayISO } from "@learn-workbench/shared";
import { Toaster } from "@/components/ui/toaster";
import { WellbeingFloat } from "@/components/wellbeing-float";

/** 一级入口：首页 / 学习 / 招花 / 职业 / 设置 */
const NAV = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
] as const;

/** 学习分组（路线图 / 今日任务 / 专注 / 日志 / 项目） */
const LEARN_ITEMS: { href: string; label: string; icon: typeof Map; hash?: string }[] = [
  { href: "/roadmap", label: "路线图", icon: Map },
  { href: "/tasks", label: "今日任务", icon: ListTodo },
  { href: "/tasks", label: "专注", icon: Timer, hash: "#focus" },
  { href: "/logs", label: "学习日志", icon: NotebookPen },
];

/** 职业分组（画像 / 技能树 / 简历 / GitHub / 面试） */
const CAREER_ITEMS = [
  { href: "/career", label: "职业画像", icon: Users },
  { href: "/career/skills", label: "技能树", icon: GraduationCap },
  { href: "/career/resume", label: "简历", icon: FileText },
  { href: "/career/interview", label: "面试", icon: MessageSquare },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const date = todayISO();
  const [careerInfo, setCareerInfo] = useState<{ name: string; percent: number } | null>(null);
  const [openMenu, setOpenMenu] = useState<"learn" | "career" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 侧边栏底部（现为顶导）：当前职业 + 整体进度
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

  // 会话有效性校验（保持不变）
  useEffect(() => {
    if (pathname === "/login") return;
    let alive = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return { __error: true };
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

  // 点击外部关闭下拉
  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  // 登录页不显示导航与布局外壳
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isJobs = pathname.startsWith("/jobs");
  const isCareer = pathname.startsWith("/career");
  const learnActive = pathname.startsWith("/roadmap") || pathname.startsWith("/tasks") || pathname.startsWith("/logs");

  return (
    <>
      {/* 桌面端顶导（毛玻璃，5 入口） */}
      <header className="glass-nav app-topnav sticky top-0 z-40 h-16 items-center border-b px-5">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <span className="hidden lg:block">
              <span className="block text-base font-semibold leading-tight text-foreground">学习工作台</span>
              <span className="block text-xs text-muted-foreground">学习 → 技能 → 职业成长</span>
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive(item.href) ? "bg-indigo-500/10 text-foreground" : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </Link>
            ))}

            {/* 学习（下拉分组） */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "learn" ? null : "learn")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  learnActive ? "bg-indigo-500/10 text-foreground" : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                <GraduationCap className="size-4.5" />
                学习
                <ChevronDown className={cn("size-3.5 transition-transform", openMenu === "learn" && "rotate-180")} />
              </button>
              {openMenu === "learn" ? (
                <div ref={menuRef} className="glass absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl p-1.5 shadow-lg">
                  {LEARN_ITEMS.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href + (item.hash ?? "")}
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/15"
                    >
                      <item.icon className="size-4 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {/* 招花 */}
            <Link
              href="/jobs"
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isJobs ? "bg-emerald-500/10 text-foreground" : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
              )}
            >
              <Flower className="size-4.5" />
              招花
            </Link>

            {/* 职业（下拉分组） */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "career" ? null : "career")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  isCareer ? "bg-indigo-500/10 text-foreground" : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
                )}
              >
                <Rocket className="size-4.5" />
                职业
                <ChevronDown className={cn("size-3.5 transition-transform", openMenu === "career" && "rotate-180")} />
              </button>
              {openMenu === "career" ? (
                <div ref={menuRef} className="glass absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl p-1.5 shadow-lg">
                  {CAREER_ITEMS.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/15"
                    >
                      <item.icon className="size-4 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <Link
              href="/settings"
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isActive("/settings") ? "bg-indigo-500/10 text-foreground" : "text-muted-foreground hover:bg-white/15 hover:text-foreground"
              )}
            >
              <Settings className="size-4.5" />
              设置
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            {careerInfo ? (
              <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
                <span className="max-w-28 truncate font-medium text-foreground">{careerInfo.name}</span>
                <span className="tabular-nums text-muted-foreground">{careerInfo.percent}%</span>
              </div>
            ) : null}
            <span className="hidden text-xs text-muted-foreground md:block">今日 {date}</span>
          </div>
        </div>
      </header>

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

      {/* 移动端底部导航（毛玻璃，5 入口） */}
      <nav className="glass-nav app-bottomnav fixed inset-x-0 bottom-0 z-30 border-t">
        {[
          { href: "/dashboard", label: "首页", icon: LayoutDashboard },
          { href: "/roadmap", label: "学习", icon: GraduationCap },
          { href: "/jobs", label: "招花", icon: Flower },
          { href: "/career", label: "职业", icon: Rocket },
          { href: "/settings", label: "我的", icon: Settings },
        ].map((item) => {
          const active = isActive(item.href);
          const jobs = item.href === "/jobs";
          const career = item.href === "/career";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? (jobs ? "text-emerald-500" : "text-primary") : "text-muted-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 健康提醒系统级浮层（wellbeing 收敛，不再占一级导航） */}
      <WellbeingFloat />

      <Toaster />
    </>
  );
}
