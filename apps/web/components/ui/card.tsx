import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  hover = true,
  sheen = false,
  rail,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
  /** v1.28：悬停扫光（只给首屏主卡用，别满屏都扫） */
  sheen?: boolean;
  /** v1.28：左缘三线细轨 —— 表明这张卡属于学习 / 职业 / 健康哪条线 */
  rail?: "study" | "career" | "health";
}) {
  return (
    <div
      className={cn(
        "paper-card",
        hover && "paper-hover",
        sheen && "sheen",
        rail === "study" && "line-rail line-study",
        rail === "career" && "line-rail line-career",
        rail === "health" && "line-rail line-health",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[1.0625rem] font-semibold leading-snug tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-2", className)} {...props} />;
}
