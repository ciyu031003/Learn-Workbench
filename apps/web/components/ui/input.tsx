import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-xl backdrop-saturate-150 transition-all placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    />
  );
}

