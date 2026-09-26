"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * v13 U5：长按确认按钮（技法参考 uiverse.io/Sameer2244/friendly-wasp-57, MIT）。
 * 用于删除/清空这类不可逆操作：按住 0.9s 填满才触发；松手/移出即取消。
 */
export function HoldButton({
  children,
  onConfirm,
  holdMs = 900,
  busy,
  className,
  icon,
}: {
  children: React.ReactNode;
  onConfirm: () => void;
  holdMs?: number;
  busy?: boolean;
  className?: string;
  icon?: React.ReactNode;
}) {
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  function start() {
    if (busy) return;
    setDone(false);
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      setDone(true);
      onConfirm();
    }, holdMs);
  }

  return (
    <button
      type="button"
      disabled={busy}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          setDone(true);
          onConfirm();
        }
      }}
      className={cn(
        "press-soft sheen relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-danger/40 bg-surface px-3.5 py-2 text-sm font-medium text-danger-strong shadow-[var(--elev-1)] transition-all duration-200 hover:border-danger/70 hover:shadow-[var(--elev-2)] disabled:opacity-60",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 origin-left bg-danger/18 transition-transform ease-linear",
          holding ? "scale-x-100" : "scale-x-0"
        )}
        style={{ transitionDuration: holding ? `${holdMs}ms` : "160ms" }}
      />
      <span className="relative flex items-center gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : done ? <Check className="size-4" /> : icon}
        {children}
      </span>
    </button>
  );
}
