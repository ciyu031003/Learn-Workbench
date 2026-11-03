import { Fragment, useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme";
import { spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import {
  activityRingLayout,
  formatPercent,
  pickSeriesColor,
  ringDash,
} from "@/lib/chart-math";
import { ChartHeader } from "./chart-header";

export interface ActivityRingItem {
  key?: string;
  label: string;
  /** 完成比例 0..1（>1 表示超额，弧画满、图例仍显示真实百分比） */
  value: number;
  /** 图例右侧文案（如 "8/10 km"），缺省显示百分比 */
  valueLabel?: string;
  color?: string;
}

/**
 * 同心活动环（BoardUI 三环）：由外到内 3 条环、不同颜色、中心留空、下方图例。
 *
 * 半径/描边间距来自 `activityRingLayout`（纯函数已单测：尺寸缩小到放不下时**宁少画不重叠**），
 * 进度来自 `ringDash`（周长制 dashoffset + rotate(-90) 从 12 点钟开始补角）。
 * 中心刻意留空 —— 三环本身就是主体，塞数字会破坏同心圆的重心。
 */
export function ActivityRings({
  rings,
  size = 132,
  thickness = 11,
  gap = 5,
  legend = true,
  title,
  style,
}: {
  rings: ActivityRingItem[];
  size?: number;
  /** 单环描边厚度 */
  thickness?: number;
  /** 环与环之间的净空 */
  gap?: number;
  legend?: boolean;
  title?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // 三环是设计基线；多传的会截断，保证视觉密度稳定
  const list = useMemo(() => rings.slice(0, 3), [rings]);
  const layout = useMemo(
    () => activityRingLayout(size, list.length, thickness, gap),
    [size, list.length, thickness, gap]
  );
  const palette = useMemo(
    () => [colors.primary, colors.accent, colors.teal, colors.lavender],
    [colors]
  );
  const center = size / 2;

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityLabel={list
        .map((ring) => `${ring.label} ${ring.valueLabel ?? formatPercent(ring.value)}`)
        .join("，")}
    >
      <ChartHeader title={title} />
      <View style={styles.ringRow}>
        <Svg width={size} height={size}>
          {layout.map((ring, index) => {
            const item = list[index];
            if (!item) return null;
            const color = item.color ?? pickSeriesColor(palette, index);
            const dash = ringDash(ring.circumference, item.value);
            return (
              <Fragment key={item.key ?? `${item.label}-${index}`}>
                {/* 轨道 = "未完成部分"（补角），没有它就只剩一根光秃秃的弧，看不出目标 */ }
                <Circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  stroke={colors.surfaceMuted}
                  strokeWidth={ring.strokeWidth}
                  fill="none"
                />
                <Circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  stroke={color}
                  strokeWidth={ring.strokeWidth}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={dash.dasharray}
                  strokeDashoffset={dash.dashoffset}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              </Fragment>
            );
          })}
        </Svg>
      </View>

      {legend && list.length > 0 ? (
        <View style={styles.legend}>
          {list.map((item, index) => {
            const color = item.color ?? pickSeriesColor(palette, index);
            return (
              <View key={item.key ?? `${item.label}-${index}`} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={[styles.legendValue, tabularNums]} numberOfLines={1}>
                  {item.valueLabel ?? formatPercent(item.value)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: "100%", alignItems: "center" },
    ringRow: { alignItems: "center", justifyContent: "center" },
    legend: { width: "100%", marginTop: spacing.md, gap: spacing.sm },
    legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { ...typography.meta, color: colors.textMuted, flex: 1 },
    legendValue: { ...typography.caption, fontWeight: "700", color: colors.text },
  });
