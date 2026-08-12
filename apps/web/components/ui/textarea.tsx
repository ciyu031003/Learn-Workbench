import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[90px] w-full rounded-xl border border-white/25 bg-white/12 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-md transition-all placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    />
  );
}
