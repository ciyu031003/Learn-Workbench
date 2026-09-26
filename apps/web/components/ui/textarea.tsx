import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[90px] w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--elev-inset)] outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/25 focus:border-primary/60 focus:ring-4 focus:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}

