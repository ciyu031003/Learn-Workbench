"use client";

import { type ReactNode } from "react";
import { useInView } from "./motion-utils";
import { cn } from "@/lib/utils";
import type { MarketStoryChapter } from "@/lib/market/story-config";

export function RevealChart({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        inView ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.985] opacity-0"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function StorySection({
  chapter,
  showHeading = true,
  children,
}: {
  chapter: MarketStoryChapter;
  showHeading?: boolean;
  children: ReactNode;
}) {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section
      ref={ref}
      className={cn(
        "story-section flex flex-col gap-4 transition-all duration-700 ease-out",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-30"
      )}
      data-story-id={chapter.id}
    >
      {showHeading ? (
        <div className="story-heading flex items-start gap-3">
          <span className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            {chapter.kicker}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span className="font-mono text-[10px] text-primary">{chapter.index}</span>
              <span>{chapter.title}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{chapter.subtitle}</p>
          </div>
        </div>
      ) : null}
      {children}
      {showHeading ? (
        <p className="rounded-xl border border-white/10 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {chapter.conclusion}
        </p>
      ) : null}
    </section>
  );
}
