"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MarketIntelligenceFilters,
  MarketIntelligenceRange,
  MarketIntelligencePayload,
} from "@/lib/domains/market/intelligence";

type Facets = MarketIntelligencePayload["facets"];

/** 局部样式（不动 globals.css） */
const IFB_STYLES = `
.ifb-pill {
  position: absolute;
  top: 4px; bottom: 4px; left: 4px;
  width: calc((100% - 8px) / 3);
  border-radius: 8px;
  background: var(--color-primary);
  box-shadow: 0 4px 14px -6px rgba(47, 116, 192, 0.85);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 0;
}
.ifb-seg { position: relative; z-index: 1; transition: color 0.2s ease; }
.ifb-select-active {
  border-color: color-mix(in oklab, var(--color-primary) 60%, transparent) !important;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 18%, transparent);
  color: var(--color-primary);
}
@media (prefers-reduced-motion: reduce) {
  .ifb-pill { transition: none; }
}
`;

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { key: string; label: string; count: number }[];
  onChange: (value: string) => void;
}) {
  const active = value !== "";
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
      <span className={cn("flex items-center gap-1 px-1", active && "font-bold text-primary")}>
        <SlidersHorizontal className="size-3" />
        {label}
        {active ? <span className="size-1.5 rounded-full bg-primary" /> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 min-w-0 rounded-xl border border-border bg-surface px-2.5 text-xs font-semibold text-foreground outline-none transition-[box-shadow,border-color,color] focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
          active && "ifb-select-active"
        )}
      >
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export function MarketIntelligenceFilterBar({
  filters,
  facets,
  onChange,
  onClear,
}: {
  filters: MarketIntelligenceFilters;
  facets: Facets;
  onChange: (patch: Partial<MarketIntelligenceFilters>) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(filters.q ?? "");

  const setIndustry = (value: string) => {
    const [sector, subsector] = value.split(" / ");
    onChange({
      industrySector: value ? sector : undefined,
      industrySubsector: value && subsector ? subsector : undefined,
    });
  };

  const industryValue = filters.industrySector
    ? filters.industrySubsector
      ? `${filters.industrySector} / ${filters.industrySubsector}`
      : filters.industrySector
    : "";

  const rangeButtons: { value: MarketIntelligenceRange; label: string }[] = [
    { value: 7, label: "7天" },
    { value: 30, label: "30天" },
    { value: 90, label: "90天" },
  ];

  // 已生效条件数：与筛选口径一致（仅统计有值的项），用于重置按钮的启用与计数徽标
  const activeCount = [
    Boolean(filters.q),
    Boolean(filters.city),
    Boolean(filters.functionKey),
    Boolean(filters.industrySector),
    Boolean(filters.seniorityBucket),
    Boolean(filters.source),
    filters.salaryMin != null,
    filters.salaryMax != null,
  ].filter(Boolean).length;
  const queryPending = (filters.q ?? "") !== query.trim();
  const rangeIndex = Math.max(0, rangeButtons.findIndex((b) => b.value === (filters.range ?? 90)));

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/55 p-3 backdrop-blur">
      <style>{IFB_STYLES}</style>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onChange({ q: query.trim() || undefined });
              }}
              placeholder="搜索职位 / 公司 / 技能"
              className={cn("h-9 pl-9", queryPending && "border-primary/60 ring-2 ring-primary/20")}
            />
            {/* 输入了但还没回车时给个明确提示：避免"我搜了怎么没反应" */}
            {queryPending ? (
              <span className="absolute -bottom-4 left-3 text-[10px] font-medium text-primary">回车应用搜索</span>
            ) : null}
          </div>
          <FilterSelect
            label="城市"
            value={filters.city ?? ""}
            options={facets.cities}
            onChange={(value) => onChange({ city: value || undefined })}
          />
          <FilterSelect
            label="职能"
            value={filters.functionKey ?? ""}
            options={facets.functions}
            onChange={(value) => onChange({ functionKey: value || undefined })}
          />
          <FilterSelect
            label="行业"
            value={industryValue}
            options={facets.industries}
            onChange={setIndustry}
          />
          <FilterSelect
            label="资历"
            value={filters.seniorityBucket ?? ""}
            options={facets.seniorities}
            onChange={(value) => onChange({ seniorityBucket: value || undefined })}
          />
          <FilterSelect
            label="来源"
            value={filters.source ?? ""}
            options={facets.sources}
            onChange={(value) => onChange({ source: value || undefined })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">薪资</span>
            <Input
              type="number"
              min="0"
              value={filters.salaryMin ?? ""}
              onChange={(event) =>
                onChange({
                  salaryMin: event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
              placeholder="最低K"
              className="h-9 w-24"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              min="0"
              value={filters.salaryMax ?? ""}
              onChange={(event) =>
                onChange({
                  salaryMax: event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
              placeholder="最高K"
              className="h-9 w-24"
            />
          </div>

          <div className="relative flex items-center gap-1 rounded-xl border border-white/10 bg-muted/30 p-1">
            {/* 滑动指示胶囊：分段控件的选中态用一个会滑动的底片表达 */}
            <span className="ifb-pill" style={{ transform: `translateX(${rangeIndex * 100}%)` }} aria-hidden />
            {rangeButtons.map((button) => {
              const active = (filters.range ?? 90) === button.value;
              return (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => onChange({ range: button.value })}
                  aria-pressed={active}
                  className={cn(
                    "ifb-seg h-7 rounded-lg px-2.5 text-[11px]",
                    active ? "font-bold text-primary-foreground" : "font-semibold text-muted-foreground hover:text-foreground"
                  )}
                >
                  {button.label}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeCount > 0 ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">已选 {activeCount}</span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={activeCount === 0}
              className={cn("text-muted-foreground", activeCount === 0 && "opacity-40")}
            >
              <RotateCcw className="size-3.5" />
              重置
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
