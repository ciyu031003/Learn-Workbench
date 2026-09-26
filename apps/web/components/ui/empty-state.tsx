import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * v13 U12：空状态升级（底纹技法参考 uiverse.io/csemszepp/old-hound-37 与 kind-frog-70, MIT）。
 * 底纹只做氛围：不透明度已压到 3%–7%，深色档另有一套灰阶。
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
  pattern = "chevron",
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  /** bauhaus：暖色几何拼花；cheveron：灰阶 3D 人字纹；none：纯色 */
  pattern?: "bauhaus" | "chevron" | "none";
}) {
  return (
    <div className={cn("fade-up edge-light relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl px-6 py-10 text-center", className)}>
      {pattern !== "none" ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            pattern === "bauhaus" ? "pattern-bauhaus" : "pattern-chevron",
            "[mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
          )}
        />
      ) : null}
      <span className="icon-chip icon-chip-glow relative h-12 w-12">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <div className="relative">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="relative">{action}</div> : null}
    </div>
  );
}
