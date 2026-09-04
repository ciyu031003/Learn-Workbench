import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/12 text-primary-strong",
        accent: "border-accent/15 bg-accent/12 text-accent-strong",
        muted: "border-border bg-muted text-muted-foreground",
        success: "border-success/15 bg-success/12 text-success-strong",
        warning: "border-warning/20 bg-warning/12 text-warning-strong",
        danger: "border-danger/15 bg-danger/12 text-danger-strong",
        outline: "border-border bg-surface text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

