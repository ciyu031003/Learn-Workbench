"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeValue = "light" | "dark" | "auto";

const OPTIONS: { value: ThemeValue; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "浅色", Icon: Sun },
  { value: "dark", label: "深色", Icon: Moon },
  { value: "auto", label: "跟随系统", Icon: Monitor },
];

/**
 * v13 U9：主题分段控件（技法参考 uiverse.io/JkHuger/itchy-turtle-45 的日夜形变与过冲缓动, MIT）。
 * 滑块用 --ease-overshoot 过冲，选中项图标轻微放大；三档保持"浅色/深色/跟随系统"语义不变。
 */
export function ThemeSegmented({
  value,
  onChange,
  className,
}: {
  value: ThemeValue;
  onChange: (value: ThemeValue) => void;
  className?: string;
}) {
  const index = Math.max(0, OPTIONS.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label="主题模式"
      className={cn("relative grid grid-cols-3 rounded-full border border-border bg-muted/60 p-1", className)}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-surface shadow-[0_2px_8px_rgba(60,50,30,0.14)]"
        style={{
          transform: "translateX(" + index * 100 + "%)",
          transition: "transform var(--motion-base) var(--ease-overshoot)",
        }}
      />
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <o.Icon
              className="size-3.5 transition-transform"
              style={{
                transform: active ? "scale(1.1)" : "scale(0.9)",
                transitionDuration: "var(--motion-base)",
                transitionTimingFunction: "var(--ease-overshoot)",
              }}
            />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
