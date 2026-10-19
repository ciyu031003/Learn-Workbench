"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 玻璃弹窗（S6-5 a11y 改造）。
 *
 * 为什么换 @radix-ui/react-dialog：
 *  - 自研版本只做了 Esc 关闭，**没有焦点陷阱**：Tab 会跑到被遮罩的页面上，
 *    键盘/读屏用户会"进得去出不来"（WCAG 2.1.2 / 2.4.3）；
 *  - Radix 免费提供：焦点陷阱 + 打开时自动聚焦 + 关闭后焦点归还触发元素 +
 *    背景滚动锁 + aria-modal / aria-labelledby 正确关联 + Esc/遮罩点击关闭。
 *
 * 视觉与 API 完全不变：调用方仍是 GlassModal(open, onClose, title, className, children)，
 * 玻璃/圆角/阴影沿用原类名；出入场动画改由 globals.css 的 [data-state] 选择器驱动，
 * 这样 Radix 的 Presence 会等关闭动画播完再卸载节点，退场效果与旧版一致。
 */
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
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Esc / 遮罩点击 / 关闭按钮最终都收敛到 onClose，保持旧 API 语义
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          // 标题已由 Dialog.Title 提供 aria-labelledby；不额外要求描述文本（避免读屏冗余）
          aria-describedby={undefined}
          className={cn(
            "dialog-content surface-nav edge-light fixed z-50 max-h-[86dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-[20px] p-6 shadow-[var(--elev-3)]",
            className
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="关闭"
              className="press-soft rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
