"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 离场动画时长（与 globals.css 的 .modal-*-out 保持一致） */
const EXIT_MS = 180;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GlassModal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  // 只在客户端 portal；并区分"打开中"与"正在离场"，让关闭也有动画。
  // mounted 用 useSyncExternalStore 做 hydration 检测（SSR false / 客户端 true），
  // 替代旧的 setState-in-effect 写法（react-hooks/set-state-in-effect 会报 error）。
  const emptySubscribe = React.useCallback(() => () => {}, []);
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [visible, setVisible] = React.useState(false);
  const [closing, setClosing] = React.useState(false);

  // open 的派生状态在**渲染期**调整（React 官方推荐的 props→state 模式）：
  // 打开 → visible 且非离场；关闭 → 进入离场动画（reduced-motion 直接落位）。
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      if (prefersReducedMotion()) {
        setVisible(false);
        setClosing(false);
      } else {
        setClosing(true);
      }
    }
  }

  // 离场动画计时器：外部系统（setTimeout）订阅，收尾落位
  React.useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  // Esc 关闭（原生 dialog 的常规预期；不改变 onClose 的语义）
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !visible) return null;

  // 用 portal 挂到 body：避免被 `.page-enter` 等带 transform 的祖先
  // 改变 `position: fixed` 的包含块，导致弹窗无法相对视口居中。
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 朦胧遮罩：半透明 + 轻微模糊，保留玻璃朦胧感 */}
      <div
        className={cn("absolute inset-0 bg-black/40 backdrop-blur-sm", closing ? "modal-backdrop-out" : "modal-backdrop-in")}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "surface-nav edge-light relative max-h-[86dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-[20px] p-6 shadow-[var(--elev-3)]",
          closing ? "modal-panel-out" : "modal-panel-in",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="press-soft rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
