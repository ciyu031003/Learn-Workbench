import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Line, Polygon, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/theme";
import { tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import {
  clamp01,
  formatPercent,
  polarPoint,
  polygonPoints,
  radarAxisAngles,
  radarLabelAnchor,
  radarPoints,
  withAlpha,
} from "@/lib/chart-math";
import { ChartHeader } from "./chart-header";
import { useChartWidth } from "./use-chart-width";

export interface RadarAxis {
  key?: string;
  /** 维度名（知识图谱：记忆/理解/应用…） */
  label: string;
}

/**
 * 雷达图（BoardUI 能力画像）：4-6 维、填充 + 可选描边对照、中心可选分数。
 *
 * 顶点角度/多边形来自 `radarAxisAngles` / `radarPoints` / `polygonPoints`（已单测），
 * 轴标签锚点由 `radarLabelAnchor` 按 cos 分量决定，避免标签压到多边形上。
 * 两个态：`values` 是填充态（主色半透明 + 描边），`compareValues` 是纯描边态（虚线），
 * 用来对比"本期 vs 上期"而不互相遮挡。
 */
export function RadarChart({
  axes,
  values,
  compareValues,
  filled = true,
  score,
  scoreLabel,
  size,
  rings = 4,
  title,
  style,
}: {
  axes: RadarAxis[];
  /** 每维 0..1（必须与 axes 同序） */
  values: number[];
  /** 对照序列（只描边、虚线） */
  compareValues?: number[];
  /** 主序列是否填充（false = 只有描边） */
  filled?: boolean;
  /** 中心分数（可选） */
  score?: string | number;
  scoreLabel?: string;
  /** 覆盖边长（默认 min(实测宽, 240)） */
  size?: number;
  /** 网格环数 1..5 */
  rings?: number;
  title?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, onLayout } = useChartWidth(280);
  const axesList = useMemo(() => axes.slice(0, 8), [axes]);
  const levelCount = Math.max(1, Math.min(5, Math.round(rings)));

  if (axesList.length < 3) return null;

  const side = Math.max(96, size ?? Math.min(width, 240));
  const cx = side / 2;
  const cy = side / 2;
  const radius = side / 2 - 26;
  const angles = radarAxisAngles(axesList.length);
  const valuesList = axesList.map((_, index) => values[index] ?? 0);
  const compareList = compareValues ? axesList.map((_, index) => compareValues[index] ?? 0) : null;
  const mainPoints = polygonPoints(radarPoints(valuesList, cx, cy, radius));
  const comparePoints = compareList ? polygonPoints(radarPoints(compareList, cx, cy, radius)) : null;
  const summary = axesList
    .map((axis, index) => `${axis.label} ${formatPercent(clamp01(valuesList[index] ?? 0))}`)
    .join("，");

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout} accessibilityLabel={title ?? summary}>
      <ChartHeader title={title} />
      <View style={{ width: side, height: side }}>
        <Svg width={side} height={side}>
          {Array.from({ length: levelCount }, (_, levelIndex) => {
            const ratio = (levelCount - levelIndex) / levelCount;
            const ring = polygonPoints(
              radarPoints(axesList.map(() => ratio), cx, cy, radius)
            );
            return (
              <Polygon
                key={`ring-${levelIndex}`}
                points={ring}
                fill="none"
                stroke={colors.border}
                strokeWidth={1}
              />
            );
          })}

          {angles.map((deg, index) => {
            const end = polarPoint(cx, cy, radius, deg);
            return (
              <Line
                key={`spoke-${index}`}
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke={colors.border}
                strokeWidth={1}
              />
            );
          })}

          {comparePoints ? (
            <Polygon
              points={comparePoints}
              fill="none"
              stroke={colors.textFaint}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ) : null}

          <Polygon
            points={mainPoints}
            fill={filled ? withAlpha(colors.primary, 0.18) : "none"}
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {angles.map((deg, index) => {
            const point = polarPoint(cx, cy, radius + 14, deg);
            return (
              <SvgText
                key={`axis-${index}`}
                x={point.x}
                y={point.y + 4}
                fontSize={typography.meta.fontSize}
                fontWeight={typography.meta.fontWeight}
                fill={colors.textMuted}
                textAnchor={radarLabelAnchor(deg)}
              >
                {axesList[index].label}
              </SvgText>
            );
          })}
        </Svg>

        {score !== undefined && score !== null ? (
          <View style={styles.center} pointerEvents="none">
            <Text style={[styles.score, tabularNums]} numberOfLines={1}>
              {score}
            </Text>
            {scoreLabel ? (
              <Text style={styles.scoreLabel} numberOfLines={1}>
                {scoreLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: "100%", alignItems: "center" },
    center: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    score: { ...typography.title2, color: colors.text },
    scoreLabel: { ...typography.caption, fontWeight: "400", color: colors.textMuted, marginTop: 1 },
  });
