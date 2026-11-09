import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "@/theme";
import { spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { arcPath, pickSeriesColor, segmentArcs } from "@/lib/chart-math";
import { ChartHeader } from "./chart-header";

export interface SegmentRingItem {
  key?: string;
  label: string;
  /** 非负数：只决定角度占比（不是百分比、不必合计 100） */
  value: number;
  /** 覆盖默认调色（默认按 index 取 colors.chart） */
  color?: string;
  /** 图例右侧文案（默认显示 value 本身） */
  valueLabel?: string;
}

/**
 * 分段评分环（BoardUI 睡眠评分样式）：多段弧 + 中心大数字 + 下方图例/分值行。
 *
 * 几何全部来自 `segmentArcs`（纯函数已单测）：按数值比例分 360°、段间留 `gapDeg`，
 * 从 12 点钟顺时针铺开；每段用 round 线帽，视觉上是"一节一节的糖葫芦"而不是连续渐变，
 * 这样用户能一眼看出各段占比。值为 0 的段不画弧，但**图例保留**（分类说明不能凭空消失）。
 */
export function SegmentRing({
  segments,
  score,
  scoreLabel,
  caption,
  title,
  legend = true,
  size = 168,
  thickness = 14,
  gapDeg = 16,
  style,
}: {
  segments: SegmentRingItem[];
  /** 中心大数字（如睡眠评分 86） */
  score: string | number;
  /** 中心数字下方小字（"睡眠评分"） */
  scoreLabel?: string;
  /** 中心最下方说明（"目标 85"） */
  caption?: string;
  title?: string | null;
  /** 是否显示下方图例（默认 true） */
  legend?: boolean;
  size?: number;
  /** 环的描边厚度 */
  thickness?: number;
  /** 段间空隙（度）；段数多时会自动收敛，避免把环挤成点 */
  gapDeg?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const center = size / 2;
  const radius = Math.max(0, (size - thickness) / 2);
  const arcs = useMemo(
    () => segmentArcs(segments.map((item) => item.value), gapDeg),
    [segments, gapDeg]
  );

  return (
    <View style={[styles.wrap, style]}>
      <ChartHeader title={title} />
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* 空轨道：没有数据时也能看出"这里是一个环" */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.chartTrack}
            strokeWidth={thickness}
            fill="none"
          />
          {arcs.map((arc, index) => {
            const d = arcPath(center, center, radius, arc.start, arc.end);
            if (!d) return null;
            return (
              <Path
                key={segments[index]?.key ?? index}
                d={d}
                stroke={segments[index]?.color ?? pickSeriesColor(colors.chart, index)}
                strokeWidth={thickness}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text
            style={[styles.score, tabularNums, { fontSize: Math.round(size * 0.24) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {score}
          </Text>
          {scoreLabel ? (
            <Text style={styles.scoreLabel} numberOfLines={1}>
              {scoreLabel}
            </Text>
          ) : null}
          {caption ? (
            <Text style={styles.caption} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
      </View>

      {legend && segments.length > 0 ? (
        <View style={styles.legend}>
          {segments.map((item, index) => (
            <View key={item.key ?? `${item.label}-${index}`} style={styles.legendRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: item.color ?? pickSeriesColor(colors.chart, index) },
                ]}
              />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.legendValue, tabularNums]} numberOfLines={1}>
                {item.valueLabel ?? String(item.value)}
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
    wrap: { width: "100%", alignItems: "center" },
    center: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    score: { fontWeight: "800", letterSpacing: -0.8, color: colors.text },
    scoreLabel: { ...typography.micro, color: colors.textMuted, marginTop: 1 },
    caption: { ...typography.caption, fontWeight: "400", color: colors.textFaint, marginTop: 2 },
    legend: { width: "100%", marginTop: spacing.lg, gap: spacing.sm },
    legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { ...typography.meta, color: colors.textMuted, flex: 1 },
    legendValue: { ...typography.caption, fontWeight: "700", color: colors.text },
  });
