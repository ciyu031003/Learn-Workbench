"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ListTree, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StudyTocItem } from "@/lib/exam-408-study";

/**
 * 精读目录（桌面三栏的左栏 / 移动端抽屉）。
 *
 * 能力：
 *  - scrollspy：IntersectionObserver 观察正文标题，滚动时高亮当前小节（不受长文重排影响）；
 *  - 阅读进度：监听滚动计算「正文已读百分比」，画在目录顶部；
 *  - 层级 + 可折叠：h2 作为分组，h3 收在分组下面，可逐个折叠；
 *  - 点击平滑滚动（尊重 prefers-reduced-motion）、同步 URL hash、键盘 ↑/↓ 在目录项间移动。
 *
 * 为什么单独一个 client 组件：目录高亮与折叠都依赖浏览器状态，页面本身仍是服务端渲染。
 */
interface StudyTocProps {
  items: StudyTocItem[];
  className?: string;
}

interface TocSection {
  item: StudyTocItem;
  children: StudyTocItem[];
}

function buildSections(items: StudyTocItem[]): TocSection[] {
  const sections: TocSection[] = [];
  for (const item of items) {
    if (item.level <= 2 || sections.length === 0) sections.push({ item, children: [] });
    else sections.at(-1)!.children.push(item);
  }
  return sections;
}

function useActiveHeading(items: StudyTocItem[], enabled = true) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const visibleRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibleRef.current.add(entry.target.id);
          else visibleRef.current.delete(entry.target.id);
        }
        const visible = items.filter((item) => visibleRef.current.has(item.id));
        if (visible.length > 0) {
          // 同屏多个标题时取文档顺序最靠后的那个（最接近当前位置的小节）
          setActiveId(visible[visible.length - 1]!.id);
        }
      },
      // 顶部留出标题吸顶/阅读起点，底部收窄让「刚进入视口」的标题立刻生效
      { rootMargin: "-88px 0px -58% 0px", threshold: 0 },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items, enabled]);

  return activeId;
}

function useReadingProgress(enabled = true) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, Math.round((root.scrollTop / max) * 100))) : 0);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return progress;
}

/** 点击目录项：平滑滚动 + hash + 高亮（供桌面与移动端复用）。 */
export function scrollToHeading(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  window.history.replaceState(null, "", "#" + id);
}

function TocList({
  sections,
  activeId,
  collapsed,
  onToggle,
  onNavigate,
  compact,
}: {
  sections: TocSection[];
  activeId: string;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: () => void;
  compact?: boolean;
}) {
  const listRef = useRef<HTMLOListElement | null>(null);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-toc-link]") ?? []);
    const current = document.activeElement as HTMLAnchorElement | null;
    const index = current ? links.indexOf(current) : -1;
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? links[index + 1] : links[index - 1];
    next?.focus();
  }, []);

  const renderLink = (item: StudyTocItem, isChild: boolean) => {
    const active = activeId === item.id;
    return (
      <a
        key={item.id}
        href={"#" + item.id}
        data-toc-link
        aria-current={active ? "location" : undefined}
        onClick={(event) => {
          event.preventDefault();
          scrollToHeading(item.id);
          onNavigate();
        }}
        className={cn(
          "block rounded-md border-l-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          isChild ? "pl-3 text-[12.5px]" : "pl-2.5 text-[13px]",
          active
            ? "border-primary bg-primary/10 font-medium text-primary"
            : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
        )}
      >
        {item.text}
      </a>
    );
  };

  return (
    <ol
      ref={listRef}
      onKeyDown={handleKeyDown}
      className={cn("flex flex-col gap-0.5", compact && "gap-1")}
    >
      {sections.map((section) => {
        const hasChildren = section.children.length > 0;
        const isCollapsed = collapsed.has(section.item.id);
        return (
          <li key={section.item.id} className="flex flex-col">
            <div className="flex items-start gap-1">
              {renderLink(section.item, false)}
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isCollapsed ? "展开本节" : "折叠本节"}
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggle(section.item.id)}
                  className="mt-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", isCollapsed && "-rotate-90")} />
                </button>
              ) : null}
            </div>
            {hasChildren && !isCollapsed ? (
              <ol className="mt-0.5 flex flex-col gap-0.5 pl-2">
                {section.children.map((child) => (
                  <li key={child.id}>{renderLink(child, true)}</li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** 桌面左栏目录：进度条 + scrollspy + 折叠 + 键盘可达。 */
export function StudyToc({ items, className }: StudyTocProps) {
  const sections = useMemo(() => buildSections(items), [items]);
  const activeId = useActiveHeading(items);
  const progress = useReadingProgress();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <nav className={cn("flex max-h-full min-h-0 w-full flex-col gap-3", className)} aria-label="本节目录">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ListTree className="size-3.5" /> 本节目录
        </p>
        <span className="text-[11px] tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" role="presentation">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 motion-reduce:transition-none"
          style={{ width: progress + "%" }}
        />
      </div>
      {/* 标题/进度固定，只有目录列表滚动：侧栏整体 sticky 到 top-24，列表在自己高度内独立滚动 */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <TocList sections={sections} activeId={activeId} collapsed={collapsed} onToggle={toggle} onNavigate={() => {}} compact />
      </div>
    </nav>
  );
}

/** 移动端目录：右上角「目录」按钮 + 底部抽屉（ESC/遮罩关闭，打开时锁滚动）。 */
export function StudyTocMobile({ items }: StudyTocProps) {
  const [open, setOpen] = useState(false);
  const sections = useMemo(() => buildSections(items), [items]);
  const activeId = useActiveHeading(items, open);
  const progress = useReadingProgress(open);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card/80 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ListTree className="size-3.5 text-primary" /> 目录 · {items.length}
      </button>
      {/*
        用 portal 挂到 body：本页外层为了做宽屏版心用了 transform（left-1/2 + -translate-x-1/2），
        而 transform 会成为 fixed 定位的包含块，直接把抽屉写在原地会「相对整页底部」而不是相对视口。
      */}
      {open && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-[2px]" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="本节目录"
            className="flex max-h-[82dvh] w-full flex-col gap-3 rounded-t-2xl border border-border/70 bg-card p-4 pb-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <ListTree className="size-4 text-primary" /> 本节目录
                <span className="text-[11px] font-normal tabular-nums text-muted-foreground">{progress}%</span>
              </p>
              <button
                type="button"
                aria-label="关闭目录"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted" role="presentation">
              <div className="h-full rounded-full bg-primary" style={{ width: progress + "%" }} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TocList sections={sections} activeId={activeId} collapsed={collapsed} onToggle={toggle} onNavigate={() => setOpen(false)} compact />
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
