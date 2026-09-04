"use client";

import { useToastStore } from "@/store/toast-store";
import { CheckCircle2, Info, AlertCircle, X } from "lucide-react";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="surface-nav flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm shadow-[0_12px_36px_rgba(80,60,25,0.16)]"
        >
          {t.kind === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-success-strong" />
          ) : t.kind === "error" ? (
            <AlertCircle className="size-4 shrink-0 text-danger-strong" />
          ) : (
            <Info className="size-4 shrink-0 text-primary-strong" />
          )}
          <span className="text-foreground">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="关闭"
            className="ml-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
