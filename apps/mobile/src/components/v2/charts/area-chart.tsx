import { useId, useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "@/theme";
import { spacing, typography, type ThemeColors } from "@/theme/tokens";
import { areaPath, linePath, mapSeriesPoints, pickSeriesColor } from "@/lib/chart-math";
import { ChartHeader } from "./chart-header";
import { useChartWidth } from "./use-chart-width";

/** 内侧留白：上给端点呼吸、下给基线留位，左右避免端点被裁 */
const PAD = { top: 12, right: 10, bottom: 10, left: 10 };
/** 水平网格线（0 / 50% / 100%） */
const GRID_RATIOS = [0, 0.5, 1];

export interface AreaChartSeries {
  key?: string;
  /** 图例文案（多序列时用） */
  label?: string;
  /** 原始值序列（不是百分比）；脏数据按 0 处理 */
  values: number[];
  /** 覆盖默认序列色（默认按 index 取 colors.chart） */
  color?: string;
}

/**
 * 单/多序列面积折线（BoardUI 趋势卡）：渐变填充 + 可选激活点，纯 SVG path。
 *
 * 几何来自 `mapSeriesPoints` / `linePath` / `areaPath`（已单测）：
 * - 平滑用 Catmull-Rom 转三次贝塞尔，**节点仍过采样点**，不会把峰值"抹平"；
 * - 多序列共用同一个 domain（否则两条线各归各的，视觉上无法比较）；
 * - 宽度由 `useChartWidth` 实测（嵌在卡片里，屏宽 ≠ 可用宽）。
 * 渐变用 `stopOpacity` 而不是 rgba 色值：`colors.chart` 是十六进制，深浅两套主题都安全。
 */
export function AreaChart({
  series,
  labels,
  height = 148,
  min = 0,
  max,
  activeIndex,
  showEndDot = true,
  legend,
  title,
  caption,
  style,
}: {
  series: AreaChartSeries[];
  /** 横轴标签（数量与采样点一致时逐点对齐） */
  labels?: string[];
  /** 绘图区高度（不含横轴标签行） */
  height?: number;
  /** 纵轴下界（默认 0） */
  min?: number;
  /** 纵轴上界；缺省取全部序列的最大值 */
  max?: number;
  /** 激活点下标（点一下某天时高亮）；越界自动忽略 */
  activeIndex?: number;
  showEndDot?: boolean;
  /** 多序列图例（默认 series > 1 时显示） */
  legend?: boolean;
  title?: string | null;
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, onLayout } = useChartWidth();
  const rawId = useId();
  const gradientPrefix = useMemo(() => `lwbArea${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);
  const lower = Number.isFinite(min) ? min : 0;

  const upper = useMemo(() => {
    if (typeof max === "number" && Number.isFinite(max) && max > lower) return max;
    let peak = lower;
    for (const item of series) {
      for (const value of item.values) {
        if (Number.isFinite(value) && value > peak) peak = value;
      }
    }
    return peak > lower ? peak : lower + 1;
  }, [series, max, lower]);

  if (series.length === 0) return null;

  const baseline = height - PAD.bottom;
  const innerHeight = Math.max(0, height - PAD.top - PAD.bottom);
  const active = typeof activeIndex === "number" && activeIndex >= 0 ? Math.floor(activeIndex) : -1;
  const paths = series.map((item, index) => {
    const points = mapSeriesPoints(
      item.values,
      { width, height, padding: PAD },
      { min: lower, max: upper }
    );
    return {
      item,
      index,
      color: item.color ?? pickSeriesColor(colors.chart, index),
      points,
      line: linePath(points, true),
      area: areaPath(points, baseline, true),
    };
  });
  const showLegend = legend ?? series.length > 1;

  return (
    <View style={[styles.wrap, style]} accessibilityLabel={title ?? "趋势面积图"}>
      <ChartHeader title={title} caption={caption} />
      <View onLayout={onLayout}>
        <Svg width={width} height={height}>
          <Defs>
            {paths.map((path) => (
              <LinearGradient key={`grad-${path.index}`} id={`${gradientPrefix}${path.index}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={path.color} stopOpacity={0.26} />
                <Stop offset="1" stopColor={path.color} stopOpacity={0} />
              </LinearGradient>
            ))}
          </Defs>

          {GRID_RATIOS.map((ratio) => {
            const y = PAD.top + innerHeight * (1 - ratio);
            return (
              <Line
                key={`grid-${ratio}`}
                x1={0}
                x2={width}
                y1={y}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3 5"
              />
            );
          })}

          {paths.map((path) =>
            path.area ? (
              <Path key={`area-${path.index}`} d={path.area} fill={`url(#${gradientPrefix}${path.index})`} />
            ) : null
          )}

          {paths.map((path) =>
            path.line ? (
              <Path
                key={`line-${path.index}`}
                d={path.line}
                stroke={path.color}
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            ) : null
          )}

          {active >= 0 && paths[0]?.points[active] ? (
            <Line
              x1={paths[0].points[active].x}
              x2={paths[0].points[active].x}
              y1={PAD.top}
              y2={baseline}
              stroke={colors.borderStrong}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ) : null}

          {paths.map((path) => {
            const point = active >= 0 ? path.points[active] : undefined;
            if (!point) return null;
            return (
              <Circle
                key={`active-${path.index}`}
                cx={point.x}
                cy={point.y}
                r={4}
                fill={path.color}
                stroke={colors.surfaceStrong}
                strokeWidth={2}
              />
            );
          })}

          {active < 0 && showEndDot
            ? paths.map((path) => {
                const end = path.points[path.points.length - 1];
                if (!end) return null;
                return (
                  <Circle
                    key={`end-${path.index}`}
                    cx={end.x}
                    cy={end.y}
                    r={3}
                    fill={path.color}
                    stroke={colors.surfaceStrong}
                    strokeWidth={2}
                  />
                );
              })
            : null}
        </Svg>
      </View>

      {labels && labels.length > 0 ? (
        <View style={[styles.axis, { paddingLeft: PAD.left, paddingRight: PAD.right }]}>
          {labels.map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.axisLabel} numberOfLines={1}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}

      {showLegend ? (
        <View style={styles.legend}>
          {paths.map((path) => (
            <View key={`legend-${path.index}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: path.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {path.item.label ?? `序列 ${path.index + 1}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: "100%" },
    axis: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
    axisLabel: { ...typography.meta, color: colors.textFaint, flex: 1, textAlign: "center" },
    legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { ...typography.meta, color: colors.textMuted },
  });
