"use client";

import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { useCountUp } from "@/hooks/use-count-up";
import { cx } from "@/utils/cx";

/**
 * Orders Chart Card: paired bars for the current and comparison series.
 *
 * Originally a year of monthly orders beside last year's. Kept generic so
 * Learn-Workbench can map real arrays onto it (phase progress, daily new
 * jobs, …) and rename/format both series.
 */

export type OrdersPoint = {
  /** Label on the axis (also the hovered headline). */
  label: string;
  /** Current period value. */
  current: number;
  /** Comparison value. */
  previous: number;
};

export type ChartDelta = { label: string; color: ChipColor };

const defaultFormatValue = (value: number) => Math.round(value).toLocaleString("zh-CN");

const defaultFormatAxis = (value: number) => {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return `${Math.round(value)}`;
};

function describeDelta(current: number, previous: number): ChartDelta {
  if (previous === 0) return { label: "新增", color: "neutral" };
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return { label: "0%", color: "neutral" };
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded}%`,
    color: rounded > 0 ? "lime" : "rose",
  };
}

export function OrdersChartCard({
  data = [],
  title = "本期",
  className,
  formatValue = defaultFormatValue,
  formatAxis = defaultFormatAxis,
  currentLabel = "本期",
  previousLabel = "上期",
  comparisonLabel = "上期",
  deltaOverride,
  emptyText = "暂无可展示的数据",
}: {
  /** Points to plot; the card renders an empty state when the array is empty. */
  data?: OrdersPoint[];
  /** Headline label when no point is hovered. */
  title?: string;
  className?: string;
  /** Formats the headline and comparison values. Defaults to zh-CN grouping. */
  formatValue?: (value: number) => string;
  /** Formats the Y axis ticks. */
  formatAxis?: (value: number) => string;
  /** Legend label for the current bars. */
  currentLabel?: string;
  /** Legend label for the comparison bars. */
  previousLabel?: string;
  /** Caption after the comparison figure. */
  comparisonLabel?: string;
  /** Replaces the computed delta chip (e.g. a completion rate). */
  deltaOverride?: ChartDelta;
  emptyText?: string;
} = {}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totalCurrent = data.reduce((sum, point) => sum + point.current, 0);
  const totalPrevious = data.reduce((sum, point) => sum + point.previous, 0);
  const hovering = activeIndex !== null && activeIndex < data.length;
  const point = hovering ? data[activeIndex] : null;

  const headlineValue = point ? point.current : totalCurrent;
  const comparison = point ? point.previous : totalPrevious;
  const delta = describeDelta(headlineValue, comparison);
  const display = useCountUp(headlineValue);
  const label = point ? point.label : title;

  const yMax = Math.max(1, ...data.map((d) => Math.max(d.current, d.previous)));

  if (data.length === 0) {
    return (
      <section
        className={cx(
          "flex h-[344px] min-w-0 flex-1 flex-col gap-6 rounded-2xl bg-background-secondary-default px-4 pt-4 pb-3",
          className,
        )}
      >
        <p className="w-full text-body-medium text-text-secondary">{title}</p>
        <div className="flex flex-1 items-center justify-center text-body-medium text-text-tertiary">{emptyText}</div>
      </section>
    );
  }

  return (
    <section
      className={cx(
        "flex h-[344px] min-w-0 flex-1 flex-col gap-6 rounded-2xl bg-background-secondary-default px-4 pt-4 pb-3",
        className,
      )}
    >
      {/* Header: label over the count-up figure and its delta; legend on the right */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="w-full text-body-medium text-text-secondary">{label}</p>
          <div className="flex w-full items-center gap-2">
            <p
              key={activeIndex ?? "total"}
              className="animate-number-fade text-title-1-medium whitespace-nowrap text-text-primary tabular-nums"
            >
              {formatValue(display)}
            </p>
            {deltaOverride ? (
              <Chip variant="bold" color={deltaOverride.color}>
                {deltaOverride.label}
              </Chip>
            ) : (
              <Chip variant="bold" color={delta.color}>
                {delta.label}
              </Chip>
            )}
          </div>
          <p className="text-body-2-medium text-text-tertiary tabular-nums">
            {formatValue(comparison)} {comparisonLabel}
          </p>
        </div>
        <dl className="flex shrink-0 items-center gap-4 text-body-2-medium text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-9-active" aria-hidden />
            <dt>{currentLabel}</dt>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-neutral" aria-hidden />
            <dt>{previousLabel}</dt>
          </div>
        </dl>
      </div>

      {/* Chart */}
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 6, bottom: 0, left: 0 }}
            barCategoryGap="28%"
            barGap={3}
            onMouseMove={(state) => {
              const index = Number(state?.activeTooltipIndex);
              if (state?.isTooltipActive && Number.isFinite(index)) setActiveIndex(index);
            }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <YAxis
              width={40}
              domain={[0, yMax * 1.1]}
              tickCount={4}
              tickFormatter={formatAxis}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval="preserveStartEnd"
              minTickGap={16}
              tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
            />
            <Tooltip content={() => null} cursor={{ fill: "var(--color-chart-track)", opacity: 0.5 }} />
            <Bar
              dataKey="previous"
              fill="var(--color-chart-neutral)"
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={450}
            />
            <Bar
              dataKey="current"
              fill="var(--color-chart-9-active)"
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={450}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
