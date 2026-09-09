"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type {
  MarketIntelligenceFilters,
  MarketIntelligenceRange,
  MarketIntelligencePayload,
} from "@/lib/domains/market/intelligence";

type Facets = MarketIntelligencePayload["facets"];

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
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
      <span className="flex items-center gap-1 px-1">
        <SlidersHorizontal className="size-3" />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-0 rounded-xl border border-border bg-surface px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/55 p-3 backdrop-blur">
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
              className="h-9 pl-9"
            />
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

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-muted/30 p-1">
            {rangeButtons.map((button) => {
              const active = (filters.range ?? 90) === button.value;
              return (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => onChange({ range: button.value })}
                  className={
                    active
                      ? "h-7 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground"
                      : "h-7 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  }
                >
                  {button.label}
                </button>
              );
            })}
          </div>

          <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-muted-foreground">
            <RotateCcw className="size-3.5" />
            重置
          </Button>
        </div>
      </div>
    </div>
  );
}
