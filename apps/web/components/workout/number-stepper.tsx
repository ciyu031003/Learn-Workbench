"use client";

import { Minus, Plus } from "lucide-react";

/**
 * 数值步进器（v8 P4-a，与 APP v6 的 MiniStepper 同规范）：
 * 字段独占一行 —— 标签在上，`− [输入] 单位 +` 在下，按钮 36×36、间距 8；
 * 不再把「组 / 次 / kg」三个输入挤在一行（那样 ± 与相邻字段会粘在一起）。
 */
export function NumberStepper({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  step = 1,
  min = 0,
  max = 9999,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const bump = (dir: number) => {
    const n = Number(value);
    const base = Number.isFinite(n) && value.trim() !== "" ? n : Number(placeholder ?? 0) || 0;
    const next = Math.min(max, Math.max(min, base + dir * step));
    onChange(String(Math.round(next * 100) / 100));
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`减少${label}`}
          className="press flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 transition-colors hover:border-primary/40 hover:bg-primary/10 active:bg-primary/15"
        >
          <Minus className="size-4 text-primary" />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))}
          inputMode="decimal"
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1 rounded-xl border border-border/60 bg-card/60 text-center text-sm font-bold tabular-nums outline-none transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        {suffix ? <span className="w-4 shrink-0 text-[11px] text-muted-foreground">{suffix}</span> : null}
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`增加${label}`}
          className="press flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 transition-colors hover:border-primary/40 hover:bg-primary/10 active:bg-primary/15"
        >
          <Plus className="size-4 text-primary" />
        </button>
      </div>
    </div>
  );
}
