"use client";

import { useMemo } from "react";
import { BarChart3, ChevronDown, MapPin, BriefcaseBusiness } from "lucide-react";
import { buildMarketStory } from "@/lib/market/story-config";
import { useCountUp, useInView } from "./motion-utils";
import type { MarketAnalysis } from "@/lib/domains/market/types";

export function MarketCover({ data }: { data: MarketAnalysis }) {
  const chapter = useMemo(() => buildMarketStory(data).find((c) => c.id === "cover") ?? buildMarketStory(data)[0], [data]);
  const { ref, inView } = useInView<HTMLElement>();
  const total = useCountUp(data.total, inView);
  const cityCount = useCountUp(data.byCity.length, inView);
  const salary = useCountUp(data.overview?.avgSalary ?? 0, inView, 700);

  return (
    <section ref={ref} className="relative overflow-hidden rounded-[24px] border border-white/12 bg-gradient-to-br from-primary/10 via-surface/60 to-transparent p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-6 lg:h-[260px] lg:flex-row lg:items-center">
        <div className="max-w-2xl min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <BarChart3 className="size-4" />
            {chapter.kicker}
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-foreground lg:text-4xl">
            招聘市场正在发生什么
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {chapter.subtitle}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ChevronDown className="size-4 animate-bounce text-primary" />
            向下滚动，看市场如何形成
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 xl:grid-cols-3">
          <CoverStat icon={<BriefcaseBusiness className="size-4 text-primary" />} value={String(Math.round(total))} label="职位样本" />
          <CoverStat icon={<MapPin className="size-4 text-primary" />} value={String(cityCount)} label="覆盖城市" />
          <CoverStat icon={<BarChart3 className="size-4 text-primary" />} value={`${Math.round(salary)}K`} label="平均薪资" />
        </div>
      </div>
    </section>
  );
}

function CoverStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums tracking-tight text-foreground lg:text-3xl">{value}</div>
    </div>
  );
}
