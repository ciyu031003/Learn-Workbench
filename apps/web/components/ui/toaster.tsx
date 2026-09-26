"use client";

import { useToastStore, type ToastItem } from "@/store/toast-store";
import { CheckCircle2, Info, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  success: { Icon: CheckCircle2, tone: "bg-success/12 text-success-strong" },
  error: { Icon: AlertCircle, tone: "bg-danger/12 text-danger-strong" },
  info: { Icon: Info, tone: "bg-primary/12 text-primary-strong" },
} as const;

/**
 * v13 U4：提示条重做（技法参考 uiverse.io/Yaya12085/smooth-seahorse-63 的图标徽章 + 副标题，
 * 以及 uiverse.io/WittyHydra/nervous-zebra-0 的"进度条 = 剩余停留时间"，均为 MIT）。
 * 只改样式，调用方 API 不变（store.push(message, kind)）。
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const { Icon, tone } = ICONS[toast.kind];
  return (
    <div
      role="status"
      className="paper-card toast-progress toast-in edge-light relative flex items-start gap-3 overflow-hidden px-3.5 py-3 pr-9"
      style={{ ["--toast-life" as string]: `${toast.lifeMs ?? 3200}ms` }}
    >
      <span className={cn("icon-chip h-8 w-8 shrink-0", tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{toast.message}</p>
        {toast.detail ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{toast.detail}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭提示"
        className="press-soft absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
