"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Map,
  ListTodo,
  NotebookPen,
  Gauge,
  Settings,
  Flower,
  Rocket,
  ChevronDown,
  GraduationCap,
  Users,
  FileText,
  MessageSquare,
  Timer,
  Briefcase,
  BarChart3,
  Download,
  UserRound,
  Award,
  FolderGit2,
  Radar,
  Repeat,
  Dumbbell,
  Salad,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { todayISO } from "@learn-workbench/shared";
import { Toaster } from "@/components/ui/toaster";
import { DomainIcon, toDomainIdentity } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import { WellbeingFloat } from "@/components/wellbeing-float";

/** 一级入口：首页 / 学习 / 招花 / 职业 / 设置 */
const NAV = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
  { href: "/today", label: "我的一天", icon: Sparkles },
] as const;

/** 学习分组（路线图 / 今日任务 / 专注 / 日志 / 项目） */
const LEARN_ITEMS: { href: string; label: string; icon: typeof Map; hash?: string }[] = [
  { href: "/roadmap", label: "路线图", icon: Map },
  { href: "/tasks", label: "今日任务", icon: ListTodo },
  { href: "/tasks", label: "专注", icon: Timer, hash: "#focus" },
  { href: "/logs", label: "学习日志", icon: NotebookPen },
  { href: "/trackers", label: "领域记录", icon: Gauge },
  { href: "/habits", label: "习惯打卡", icon: Repeat },
  { href: "/wellbeing/workout", label: "训练记录", icon: Dumbbell },
  { href: "/wellbeing/nutrition", label: "今日饮食", icon: Salad },
  { href: "/wellbeing/sports", label: "运动档案", icon: Trophy },
];

/** 职业分组（画像 / 技能树 / 简历 / GitHub / 面试 / 求职） */
const CAREER_ITEMS = [
  { href: "/career", label: "职业画像", icon: Users },
  { href: "/career/profile", label: "我的资料", icon: UserRound },
  { href: "/career/skills", label: "技能树", icon: GraduationCap },
  { href: "/career/radar", label: "就业雷达", icon: Radar },
  { href: "/career/certificates", label: "我的证书", icon: Award },
  { href: "/career/resume", label: "简历", icon: FileText },
  { href: "/career/resume-assets", label: "简历资产", icon: FolderGit2 },
  { href: "/career/interview", label: "面试", icon: MessageSquare },
  { href: "/career/applications", label: "我的求职", icon: Briefcase },
  { href: "/career/market", label: "市场分析", icon: BarChart3 },
] as const;

const DOWNLOAD_URL = "https://learn.yuanabd.cn/download.html";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const date = mounted ? todayISO() : "";
  const domain = useDomainStore((s) => s.current);
  const setDomain = useDomainStore((s) => s.setCurrent);
  const [percent, setPercent] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<"learn" | "career" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * v1.27：顶栏选中态从"整块变色"升级为**滑动胶囊指示器**。
   * 位置不写死（各项文案宽度不同），在布局稳定后按 DOM 实测：
   * 测量时机 = 挂载 / 路由变化 / 窗口尺寸变化 / 领域胶囊加载完成（它会挤动导航）。
   */
  const navRef = useRef<HTMLElement | null>(null);
  const navItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const navActiveKey =
    pathname === "/dashboard"
      ? "dashboard"
      : pathname === "/today"
        ? "today"
        : pathname.startsWith("/roadmap") || pathname.startsWith("/tasks") || pathname.startsWith("/logs")
          ? "learn"
          : pathname.startsWith("/jobs")
            ? "jobs"
            : pathname.startsWith("/career")
              ? "career"
              : pathname.startsWith("/settings")
                ? "settings"
                : null;

  useEffect(() => {
    if (pathname === "/login" || pathname === "/") return;
    const measure = () => {
      const nav = navRef.current;
      const el = navActiveKey ? navItemRefs.current[navActiveKey] : null;
      if (!nav || !el) {
        setPill(null);
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const itemBox = el.getBoundingClientRect();
      setPill({ left: itemBox.left - navBox.left, width: itemBox.width });
    };
    measure();
    // 首帧字体/图标可能还没定尺，下一帧再量一次
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [pathname, navActiveKey, domain]);

  // 客户端挂载后再算日期，避免 SSR 静态快照日期与水合不一致（React #418 同根因）
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // 顶栏领域胶囊：初始化解析当前领域身份（图标/颜色/名称），并随全局 store 实时联动
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/domains").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/settings/career").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, c]) => {
      if (!alive) return;
      if (useDomainStore.getState().current) return;
      const list = (d?.domains ?? []) as Array<{
        career_key: string;
        name: string;
        color?: string | null;
        icon?: string | null;
        kind_label?: string | null;
        is_locked?: boolean | null;
      }>;
      const saved = (c?.career as string | undefined) ?? "ict";
      const row = list.find((x) => x.career_key === saved) ?? list[0] ?? null;
      if (row) setDomain(toDomainIdentity(row));
    });
    return () => {
      alive = false;
    };
  }, [setDomain]);

  // 领域切换后刷新整体进度（percent 实时跟随当前领域）
  const domainKey = domain?.careerKey;
  useEffect(() => {
    if (!domainKey) return;
    let alive = true;
    fetch("/api/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!alive || !s) return;
        setPercent((s as { overallPercent?: number }).overallPercent ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [domainKey]);

  // 会话有效性校验（保持不变）
  useEffect(() => {
    // 公开页（登录页 / 落地页）不校验会话，否则未登录访客会被直接弹到 /login
    if (pathname === "/login" || pathname === "/") return;
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

  // 登录页与落地页不显示导航与布局外壳
  if (pathname === "/login" || pathname === "/") {
    return <>{children}</>;
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isJobs = pathname.startsWith("/jobs");
  const isCareer = pathname.startsWith("/career");
  const learnActive = pathname.startsWith("/roadmap") || pathname.startsWith("/tasks") || pathname.startsWith("/logs");

  return (
    <>
      {/* 顶栏/页面共享动效样式：挂在外壳里，保证**每个**带导航的页面都有（含 reduced-motion 守护） */}
      <WebMotionStyles />

      {/* 桌面端顶导（毛玻璃，5 入口） */}
      <header className="surface-nav app-topnav sticky top-0 z-40 h-16 items-center border-b px-5">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <img src="/app-icon.png" alt="" className="h-9 w-9 rounded-xl shadow-[0_2px_8px_rgba(60,50,30,0.12)]" />
            <span className="hidden lg:block">
              <span className="block text-base font-semibold leading-tight text-foreground">学习工作台</span>
              <span className="block text-xs text-muted-foreground">学习 → 技能 → 职业成长</span>
            </span>
          </Link>

          <nav ref={navRef} className="lwb-nav-items relative flex flex-1 items-center gap-1">
            {/* 滑动选中指示器：零 JS 动画库，纯 transform 过渡 */}
            <span
              aria-hidden
              className="lwb-nav-pill"
              data-on={pill ? "true" : "false"}
              style={pill ? { transform: "translateX(" + pill.left + "px)", width: pill.width } : undefined}
            />
            {NAV.map((item) => (
              <Link
                key={item.href}
                ref={(el) => {
                  navItemRefs.current[item.href === "/dashboard" ? "dashboard" : "today"] = el;
                }}
                href={item.href}
                className={cn(
                  "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive(item.href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="lwb-nav-icon size-4.5" />
                {item.label}
              </Link>
            ))}

            {/* 学习（下拉分组） */}
            <div className="relative">
              <button
                type="button"
                ref={(el) => {
                  navItemRefs.current["learn"] = el;
                }}
                aria-haspopup="menu"
                aria-expanded={openMenu === "learn"}
                onClick={() => setOpenMenu(openMenu === "learn" ? null : "learn")}
                className={cn(
                  "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  learnActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <GraduationCap className="lwb-nav-icon size-4.5" />
                学习
                <ChevronDown className={cn("size-3.5 transition-transform duration-300", openMenu === "learn" && "rotate-180")} />
              </button>
              {openMenu === "learn" ? (
                <div ref={menuRef} role="menu" className="lwb-menu glass absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl p-1.5 shadow-lg">
                  {LEARN_ITEMS.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href + (item.hash ?? "")}
                      onClick={() => setOpenMenu(null)}
                      className="lwb-menu-item flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/15"
                    >
                      <item.icon className="lwb-menu-icon size-4 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {/* 招花 */}
            <Link
              ref={(el) => {
                navItemRefs.current["jobs"] = el;
              }}
              href="/jobs"
              className={cn(
                "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isJobs ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Flower className="lwb-nav-icon size-4.5" />
              招花
            </Link>

            {/* 职业（下拉分组） */}
            <div className="relative">
              <button
                type="button"
                ref={(el) => {
                  navItemRefs.current["career"] = el;
                }}
                aria-haspopup="menu"
                aria-expanded={openMenu === "career"}
                onClick={() => setOpenMenu(openMenu === "career" ? null : "career")}
                className={cn(
                  "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  isCareer ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Rocket className="lwb-nav-icon size-4.5" />
                职业
                <ChevronDown className={cn("size-3.5 transition-transform duration-300", openMenu === "career" && "rotate-180")} />
              </button>
              {openMenu === "career" ? (
                <div ref={menuRef} role="menu" className="lwb-menu glass absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl p-1.5 shadow-lg">
                  {CAREER_ITEMS.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpenMenu(null)}
                      className="lwb-menu-item flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/15"
                    >
                      <item.icon className="lwb-menu-icon size-4 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <Link
              ref={(el) => {
                navItemRefs.current["settings"] = el;
              }}
              href="/settings"
              className={cn(
                "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isActive("/settings") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings className="lwb-nav-icon size-4.5" />
              设置
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            {domain ? (
              <div className="paper-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${domain.color}26`, color: domain.color }}
                >
                  <DomainIcon icon={domain.icon} className="size-3.5" />
                </span>
                <span className="max-w-24 truncate font-medium text-foreground">{domain.name}</span>
                <span className="tabular-nums text-muted-foreground">{percent === null ? "…" : `${percent}%`}</span>
              </div>
            ) : null}
            <span className="hidden text-xs text-muted-foreground md:block">今日 {date}</span>
            <a
              href={DOWNLOAD_URL}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Download className="size-4" />
              下载
            </a>
          </div>
        </div>
      </header>

      {/* 移动端顶栏（毛玻璃） */}
      <header className="surface-nav app-mobile-topbar sticky top-0 z-30 h-14 items-center justify-between border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/app-icon.png" alt="" className="h-7 w-7 rounded-lg" />
          <span className="text-sm font-semibold text-foreground">学习工作台</span>
        </Link>
        <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{date}</span>
            <a
              href={DOWNLOAD_URL}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Download className="size-4" />
              下载
            </a>
          </div>
      </header>

      <main className="app-main relative z-0 min-h-screen">
        <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-10">{children}</div>
      </main>

      {/* 移动端底部导航（毛玻璃，5 入口） */}
      <nav className="surface-nav app-bottomnav fixed inset-x-0 bottom-0 z-30 border-t">
        {[
          { href: "/dashboard", label: "首页", icon: LayoutDashboard },
          { href: "/roadmap", label: "学习", icon: GraduationCap },
          { href: "/jobs", label: "招花", icon: Flower },
          { href: "/career", label: "职业", icon: Rocket },
          { href: "/settings", label: "我的", icon: Settings },
        ].map((item) => {
          const active = isActive(item.href);
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

      {/* 健康提醒系统级浮层（wellbeing 收敛，不再占一级导航） */}
      <WellbeingFloat />

      <Toaster />
    </>
  );
}

/**
 * 页面级共享动效样式（v1.27 Web 精修）。
 *
 * 与 `globals.css` 里既有的 .ambient-glow / .page-enter 互补，不重叠命名：
 * 这里只提供「顶栏动效 + 页面光效层 + 入场 stagger」，由页面自行挂载
 * （today / dashboard 各引一次即可）。全部动效在 prefers-reduced-motion: reduce 下关闭。
 */
export function WebMotionStyles() {
  return <style dangerouslySetInnerHTML={{ __html: WEB_MOTION_CSS }} />;
}

const WEB_MOTION_CSS = [
  ".lwb-nav-pill{position:absolute;left:0;top:50%;height:38px;margin-top:-19px;z-index:0;border-radius:12px;background:color-mix(in srgb,var(--color-primary) 13%,transparent);border:1px solid color-mix(in srgb,var(--color-primary) 24%,transparent);box-shadow:0 6px 18px -12px rgba(47,116,192,.9);opacity:0;pointer-events:none;transition:transform .34s cubic-bezier(.22,.68,.32,1),width .34s cubic-bezier(.22,.68,.32,1),opacity .18s ease-out}",
  ".lwb-nav-pill[data-on='true']{opacity:1}",
  ".lwb-nav-icon{transition:transform .28s cubic-bezier(.22,.68,.32,1)}",
  ".lwb-nav-item:hover .lwb-nav-icon{transform:scale(1.14) rotate(-4deg)}",
  ".lwb-menu{animation:lwb-menu-in .22s cubic-bezier(.22,.68,.32,1) both;transform-origin:top left}",
  "@keyframes lwb-menu-in{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}",
  ".lwb-menu-item{transition:transform .18s ease-out,background-color .18s ease-out}",
  ".lwb-menu-item:hover{transform:translateX(2px)}",
  ".lwb-menu-icon{transition:transform .2s ease-out,color .2s ease-out}",
  ".lwb-menu-item:hover .lwb-menu-icon{color:var(--color-primary);transform:scale(1.1)}",
  ".lwb-tab-icon{position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:26px;border-radius:12px;transition:background-color .24s ease-out}",
  ".lwb-tab-icon[data-active='true']{background:color-mix(in srgb,var(--color-primary) 14%,transparent)}",
  ".lwb-tab-icon[data-active='true'][data-tone='accent']{background:color-mix(in srgb,var(--color-accent) 16%,transparent)}",
  ".lwb-tab-icon[data-active='true']::after{content:'';position:absolute;top:-5px;left:50%;width:16px;height:2.5px;margin-left:-8px;border-radius:9999px;background:currentColor;animation:lwb-tab-bar .34s cubic-bezier(.22,.68,.32,1) both}",
  "@keyframes lwb-tab-bar{from{transform:scaleX(.3);opacity:0}to{transform:scaleX(1);opacity:.9}}",
  ".lwb-page-aurora{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}",
  ".lwb-page-orb{position:absolute;border-radius:9999px;filter:blur(64px);opacity:.4;will-change:transform,opacity}",
  ".lwb-page-orb-a{width:460px;height:460px;top:-180px;right:-120px;background:radial-gradient(closest-side,rgba(47,116,192,.5),rgba(47,116,192,0) 72%);animation:lwb-page-drift-a 22s ease-in-out infinite alternate}",
  ".lwb-page-orb-b{width:420px;height:420px;bottom:-160px;left:-100px;background:radial-gradient(closest-side,rgba(225,120,28,.4),rgba(225,120,28,0) 72%);animation:lwb-page-drift-b 17s ease-in-out infinite alternate}",
  ".lwb-page-orb-c{width:360px;height:360px;top:38%;left:46%;background:radial-gradient(closest-side,rgba(61,163,93,.3),rgba(61,163,93,0) 72%);animation:lwb-page-drift-c 25s ease-in-out infinite alternate}",
  "html.dark .lwb-page-orb{opacity:.3}",
  "@keyframes lwb-page-drift-a{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(-46px,34px,0) scale(1.14)}}",
  "@keyframes lwb-page-drift-b{from{transform:translate3d(0,0,0) scale(1.06)}to{transform:translate3d(40px,-26px,0) scale(.95)}}",
  "@keyframes lwb-page-drift-c{from{transform:translate3d(0,0,0) scale(.96)}to{transform:translate3d(28px,30px,0) scale(1.1)}}",
  "@keyframes lwb-rise-in{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}",
  ".lwb-stagger>*{animation:lwb-rise-in .58s cubic-bezier(.22,.68,.32,1) both}",
  ".lwb-stagger>*:nth-child(1){animation-delay:0ms}",
  ".lwb-stagger>*:nth-child(2){animation-delay:70ms}",
  ".lwb-stagger>*:nth-child(3){animation-delay:140ms}",
  ".lwb-stagger>*:nth-child(4){animation-delay:210ms}",
  ".lwb-stagger>*:nth-child(5){animation-delay:280ms}",
  ".lwb-stagger>*:nth-child(6){animation-delay:350ms}",
  ".lwb-stagger>*:nth-child(7){animation-delay:420ms}",
  ".lwb-stagger>*:nth-child(8){animation-delay:490ms}",
  ".lwb-stagger>*:nth-child(n+9){animation-delay:540ms}",
  ".lwb-lift{transition:transform .3s cubic-bezier(.22,.68,.32,1),box-shadow .3s ease-out}",
  ".lwb-lift:hover{transform:translateY(-4px)}",
  ".lwb-sheen{position:relative;overflow:hidden}",
  ".lwb-sheen::after{content:'';position:absolute;top:-60%;left:-70%;width:45%;height:220%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.34),transparent);transform:rotate(9deg);animation:lwb-sheen-sweep 8.5s ease-in-out infinite;pointer-events:none}",
  "html.dark .lwb-sheen::after{background:linear-gradient(100deg,transparent,rgba(255,255,255,.09),transparent)}",
  "@keyframes lwb-sheen-sweep{0%{left:-70%}52%{left:130%}100%{left:130%}}",
  "@media (prefers-reduced-motion:reduce){.lwb-nav-pill,.lwb-nav-icon,.lwb-menu,.lwb-menu-item,.lwb-menu-icon,.lwb-tab-icon,.lwb-lift{transition:none}.lwb-menu,.lwb-page-orb,.lwb-stagger>*,.lwb-sheen::after,.lwb-tab-icon[data-active='true']::after{animation:none}.lwb-page-orb{opacity:.22}.lwb-sheen::after{opacity:0}.lwb-stagger>*{opacity:1;transform:none}}",
].join("\n");
