import * as React from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--elev-inset)] outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/25 focus:border-primary/60 focus:ring-4 focus:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);

/**
 * v13 U6：浮动标签输入（技法参考 uiverse.io/Li-Deheng/tiny-chicken-50, MIT）
 * + 聚焦时 conic 旋转描边（uiverse.io/PhanDangKhoa96/swift-warthog-78, MIT，只在聚焦时 6s 一圈）。
 */
export function FloatField({
  label,
  value,
  onChange,
  type = "text",
  className,
  icon,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  icon?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [focused, setFocused] = React.useState(false);
  // date/time 这类原生控件永远有内容，标签必须常驻上浮，否则会和"年/月/日"占位文字重叠
  const alwaysFloated = type === "date" || type === "time" || type === "datetime-local" || type === "month";
  const floated = focused || value.length > 0 || alwaysFloated;
  return (
    <div className={cn("spin-border rounded-xl", className)}>
      <div className="relative flex h-12 items-center rounded-xl border border-border bg-surface px-3 shadow-[var(--elev-inset)] transition-colors duration-200 hover:border-primary/25">
        {icon ? <span className="mr-2 text-muted-foreground">{icon}</span> : null}
        <input
          {...rest}
          type={type}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-full w-full bg-transparent text-sm text-foreground outline-none"
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 origin-left text-muted-foreground transition-all",
            floated ? "top-1.5 text-[11px]" : "top-1/2 -translate-y-1/2 text-sm"
          )}
          style={{ transitionDuration: "var(--motion-base)", transitionTimingFunction: "var(--ease-standard)" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/** v13 U6：胶囊搜索框 + 内嵌圆形提交（技法参考 uiverse.io/OnlyCodeChannel/ugly-penguin-43, MIT）。 */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "搜索…",
  className,
  submitLabel = "搜索",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  submitLabel?: string;
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className={cn(
        "spin-border flex h-11 items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-1.5 shadow-[var(--elev-1)] transition-all duration-200 focus-within:border-primary/45 focus-within:shadow-[var(--elev-2)]",
        className
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label={submitLabel}
        className="press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[image:var(--grad-primary)] text-primary-foreground shadow-[var(--elev-1)] transition-all duration-200 hover:brightness-[1.06]"
      >
        <CornerDownLeft className="size-4" aria-hidden />
      </button>
    </form>
  );
}
