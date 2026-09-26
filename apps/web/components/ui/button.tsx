import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // v1.28：加 sheen 扫光 + elevation token；press 的按压缩放保持不变
  "press sheen relative isolate inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // 主按钮：竖向主色渐变 + 一层 elevation，hover 只提亮 + 加外扩阴影（不动布局）
        default:
          "bg-[image:var(--grad-primary)] text-primary-foreground shadow-[var(--elev-1)] hover:brightness-[1.05] hover:shadow-[0_8px_24px_-8px_rgba(37,99,176,0.55)]",
        secondary:
          "border border-border bg-surface text-foreground shadow-[var(--elev-1)] hover:bg-muted hover:shadow-[var(--elev-2)]",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        outline:
          "border border-border bg-transparent text-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-primary-strong",
        danger:
          "bg-danger text-danger-foreground shadow-[0_2px_8px_rgba(192,69,69,0.18)] hover:bg-danger-strong hover:shadow-[0_8px_22px_-8px_rgba(192,69,69,0.5)]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** v13 U5：提交中——内嵌 spinner 并禁用，避免重复提交 */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));
    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button className={classes} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
