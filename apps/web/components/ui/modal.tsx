"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (!open) return null;
  // 用 portal 挂到 body：避免被 `.page-enter` 等带 transform 的祖先
  // 改变 `position: fixed` 的包含块，导致弹窗无法相对视口居中。
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 朦胧遮罩：半透明 + 轻微模糊，保留玻璃朦胧感 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "glass relative w-full max-w-md overflow-hidden rounded-3xl p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-white/15 hover:text-foreground"
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