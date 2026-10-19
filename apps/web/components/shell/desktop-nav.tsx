"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Flower, GraduationCap, Rocket, Settings } from "@/components/shell/icons";
import { cn } from "@/lib/utils";
import { DomainPill } from "@/components/shell/domain-pill";
import { CAREER_ITEMS, JOBS_ITEM, LEARN_GROUPS, NAV, SETTINGS_ITEM, getNavActiveKey, isActivePath, navHref } from "@/components/shell/nav-items";
import { useDomainStore } from "@/store/domain-store";
import type { ShellData } from "@/lib/shell-data";

/**
 * 桌面端顶栏（毛玻璃）—— 一级入口：首页 / 我的一天 / 专注 / 学习(三组下拉) / 招花 / 职业 / 设置。
 *
 * S6-6：学习下拉按「学习 / 健康 / 更多」三组重建（每组 ≤4 项）；专注独立成一级入口
 * （/tasks?focus=1，能真正打开计时器）；下载入口由 NEXT_PUBLIC_DOWNLOAD_URL 控制（未配置隐藏）。
 *
 * 选中态是"滑动胶囊指示器"（v1.27）：位置不写死（各项文案宽度不同），
 * 在布局稳定后按 DOM 实测；测量时机 = 挂载 / 路由变化 / 窗口尺寸变化 / 领域胶囊加载完成（它会挤动导航）。
 */
export function DesktopNav({ date, shell }: { date: string; shell: ShellData }) {
  const pathname = usePathname();
  const domain = useDomainStore((s) => s.current);
  const [openMenu, setOpenMenu] = useState<"learn" | "career" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const navRef = useRef<HTMLElement | null>(null);
  const navItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const navActiveKey = getNavActiveKey(pathname);
  const learnActive = navActiveKey === "learn";
  const isJobs = navActiveKey === "jobs";
  const isCareer = navActiveKey === "career";
  const focusActive = pathname === "/tasks";

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

  // 点击外部关闭下拉
  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  const navKeyOf = (label: string) => (label === "首页" ? "dashboard" : label === "我的一天" ? "today" : null);

  return (
    <header className="surface-nav app-topnav sticky top-0 z-40 h-16 items-center border-b px-5">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <Image src="/app-icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl shadow-[0_2px_8px_rgba(60,50,30,0.12)]" />
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
          {NAV.map((item) => {
            const key = navKeyOf(item.label);
            const isFocus = item.label === "专注";
            const active = isFocus ? focusActive : navActiveKey === key;
            return (
              <Link
                key={item.label}
                ref={(el) => {
                  if (key) navItemRefs.current[key] = el;
                }}
                href={navHref(item)}
                data-testid={isFocus ? "nav-focus" : undefined}
                className={cn(
                  "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  isFocus ? "text-accent-strong" : active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="lwb-nav-icon size-5" />
                {item.label}
              </Link>
            );
          })}

          {/* 学习（三组下拉：学习 / 健康 / 更多，每组 ≤4 项） */}
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
              <GraduationCap className="lwb-nav-icon size-5" />
              学习
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", openMenu === "learn" && "rotate-180")} />
            </button>
            {openMenu === "learn" ? (
              <div ref={menuRef} role="menu" className="lwb-menu glass absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl p-2 shadow-lg">
                {LEARN_GROUPS.map((group) => (
                  <div key={group.title} className="py-1">
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </p>
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        href={navHref(item)}
                        onClick={() => setOpenMenu(null)}
                        className="lwb-menu-item flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/15"
                      >
                        <item.icon className="lwb-menu-icon size-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* 招花 */}
          <Link
            ref={(el) => {
              navItemRefs.current["jobs"] = el;
            }}
            href={JOBS_ITEM.href}
            className={cn(
              "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              isJobs ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Flower className="lwb-nav-icon size-5" />
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
              <Rocket className="lwb-nav-icon size-5" />
              职业
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", openMenu === "career" && "rotate-180")} />
            </button>
            {openMenu === "career" ? (
              <div ref={menuRef} role="menu" className="lwb-menu glass absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl p-1.5 shadow-lg">
                {CAREER_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    href={navHref(item)}
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
            href={SETTINGS_ITEM.href}
            className={cn(
              "lwb-nav-item relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              isActivePath(pathname, "/settings") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings className="lwb-nav-icon size-5" />
            设置
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          <DomainPill domains={shell.domains} currentCareer={shell.currentCareer} overallPercent={shell.overallPercent} />
          <span className="hidden text-xs text-muted-foreground md:block">今日 {date}</span>
          {shell.downloadUrl ? (
            <a
              href={shell.downloadUrl}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Download className="size-4" />
              下载
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
