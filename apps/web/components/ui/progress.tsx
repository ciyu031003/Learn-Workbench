"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDisplay(v));
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("progress-track h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("progress-fill h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none", indicatorClassName)}
        style={{ width: `${display}%` }}
      />
    </div>
  );
}
