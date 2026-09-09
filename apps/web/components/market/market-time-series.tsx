"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { MarketTimePoint } from "@/lib/domains/market/intelligence";

function linePath(
  points: MarketTimePoint[],
  width: number,
  height: number,
  padding: number,
  max: number,
  get: (point: MarketTimePoint) => number | null
) {
  const usable = points.map((point, index) => ({
    x: padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2),
    y: height - padding - ((get(point) ?? 0) / Math.max(1, max)) * (height - padding * 2),
    value: get(point),
  }));
  const visible = usable.filter((point) => point.value != null);
  if (visible.length === 0) return "";
  return visible.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export function MarketTimeSeries({
  series,
  className,
}: {
  series: MarketTimePoint[];
  className?: string;
}) {
  const model = useMemo(() => {
    const maxJobs = Math.max(1, ...series.map((point) => point.newJobs));
    const salaryValues = series
      .map((point) => point.avgSalary)
      .filter((value): value is number => value != null);
    const maxSalary = Math.max(1, ...salaryValues);
    const latestJobs = series.at(-1)?.newJobs ?? 0;
    const latestSalary = series.at(-1)?.avgSalary ?? null;
    return { maxJobs, maxSalary, latestJobs, latestSalary };
  }, [series]);

  const width = 720;
  const height = 190;
  const padding = 22;
  const jobsPath = linePath(series, width, height, padding, model.maxJobs, (point) => point.newJobs);
  const salaryPath = linePath(series, width, height, padding, model.maxSalary, (point) => point.avgSalary);
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="市场新增岗位与平均薪资时间趋势"
      >
        <defs>
          <linearGradient id="market-jobs-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1={padding}
            x2={width - padding}
            y1={height - padding - (height - padding * 2) * fraction}
            y2={height - padding - (height - padding * 2) * fraction}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        ))}

        {series.length > 0 ? (
          <>
            {jobsPath ? (
              <>
                <path d={`${jobsPath} L${width - padding},${height - padding} L${padding},${height - padding} Z`} fill="url(#market-jobs-fill)" />
                <path d={jobsPath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}
            {salaryPath ? (
              <path d={salaryPath} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="4 3" />
            ) : null}
          </>
        ) : null}

        {series.map((point, index) => {
          const x = padding + index * step;
          const y = height - padding - (point.newJobs / model.maxJobs) * (height - padding * 2);
          const salaryY =
            point.avgSalary == null
              ? null
              : height - padding - (point.avgSalary / model.maxSalary) * (height - padding * 2);
          return (
            <g key={point.date}>
              <circle cx={x} cy={y} r="2.5" fill="#0ea5e9">
                <title>{`${point.date} ${point.newJobs} 个新职位`}</title>
              </circle>
              {salaryY != null ? (
                <circle cx={x} cy={salaryY} r="2" fill="#f59e0b">
                  <title>{`${point.date} 平均薪资 ${point.avgSalary}K`}</title>
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-sky-500" />
          新增岗位
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-amber-500" />
          平均薪资 K/月
        </span>
        <span className="ml-auto">
          最新 {model.latestJobs} 个新职位
          {model.latestSalary != null ? ` / ${model.latestSalary}K` : ""}
        </span>
      </div>
    </div>
  );
}
