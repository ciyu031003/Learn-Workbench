import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary to-[#4338ca] text-primary-foreground shadow-[0_6px_20px_rgba(79,70,229,0.25)] hover:shadow-[0_8px_26px_rgba(79,70,229,0.32)] hover:brightness-105",
        secondary:
          "border border-white/20 bg-white/10 text-foreground backdrop-blur-xl backdrop-saturate-150 hover:bg-white/18",
        ghost: "text-muted-foreground hover:bg-white/12 hover:text-foreground",
        outline: "border border-white/20 bg-transparent text-foreground hover:bg-white/12",
        danger:
          "bg-gradient-to-b from-danger to-[#b91c1c] text-white shadow-[0_6px_20px_rgba(220,38,38,0.25)] hover:brightness-105",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

