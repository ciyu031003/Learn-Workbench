import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { barHeight, clamp01 } from "@/lib/chart-math";
import { ChartHeader } from "./chart-header";

export interface StepsBarItem {
  /** 横轴标签（一 二 三 … / 6/29） */
  label: string;
  /** 0..1（组件内部再夹一次，脏数据不会画出溢出柱） */
  value: number;
  /** 今日高亮（主色实心 + 主色标签） */
  highlight?: boolean;
  /** 高亮柱上方的数值文案（可选，如 "8.4k"） */
  valueLabel?: string;
}

/**
 * v2 周柱状图（BoardUI 仪表盘 Steps 卡）：7 根柱、今日高亮、可选"周切换"头部。
 *
 * 为什么用 View 柱而不是 SVG：柱图只需要圆角矩形与自适应宽度，View 的 `flex` 天然铺满容器，
 * 不必先量宽；真正的曲线（面积图/雷达）才交给 react-native-svg。
 * 纯静态：本批次不接任何动画 API（动效在后续统一批次里加）。
 */
export function StepsBar({
  items,
  title = "本周",
  rangeLabel,
  onPrevWeek,
  onNextWeek,
  height = 108,
  style,
}: {
  items: StepsBarItem[];
  /** 头部标题；传 null 隐藏 */
  title?: string | null;
  /** 周区间标注："6/29-7/5"（用 formatMonthDayRange 生成） */
  rangeLabel?: string;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  /** 柱区高度（不含头部与星期标签） */
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const showHeader = Boolean(title || rangeLabel || onPrevWeek || onNextWeek);
  // 预留 18px 给高亮柱上方的数值文案，保证所有柱共享同一条基线
  const plotHeight = Math.max(12, height - 18);

  return (
    <View style={[styles.wrap, style]}>
      {showHeader ? (
        <ChartHeader
          title={title}
          right={
            <>
              {rangeLabel ? (
                <Text style={[styles.range, tabularNums]} numberOfLines={1}>
                  {rangeLabel}
                </Text>
              ) : null}
              {onPrevWeek ? (
                <Pressable
                  onPress={onPrevWeek}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="上一周"
                  style={styles.arrow}
                >
                  <ThemedIcon name="chevron-back" size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}
              {onNextWeek ? (
                <Pressable
                  onPress={onNextWeek}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="下一周"
                  style={styles.arrow}
                >
                  <ThemedIcon name="chevron-forward" size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </>
          }
        />
      ) : null}

      <View style={styles.plot}>
        {items.map((item, index) => {
          const ratio = clamp01(item.value);
          const barH = barHeight(ratio, plotHeight, 4);
          const empty = ratio <= 0;
          return (
            <View
              key={`${item.label}-${index}`}
              style={styles.column}
              accessibilityLabel={`${item.label} ${item.valueLabel ?? Math.round(ratio * 100) + "%"}`}
            >
              <View style={[styles.barArea, { height }]}>
                {item.highlight && item.valueLabel ? (
                  <Text style={styles.valueLabel} numberOfLines={1}>
                    {item.valueLabel}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    { height: barH },
                    empty
                      ? styles.barEmpty
                      : item.highlight
                        ? styles.barActive
                        : styles.barIdle,
                  ]}
                />
              </View>
              <Text
                style={[styles.weekday, item.highlight && styles.weekdayActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: "100%" },
    range: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    arrow: { paddingHorizontal: 2, minHeight: 24, justifyContent: "center" },
    plot: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
    column: { flex: 1, alignItems: "center", gap: 6 },
    barArea: { width: "100%", alignItems: "center", justifyContent: "flex-end" },
    bar: { width: "62%", maxWidth: 22, borderRadius: radius.sm },
    barIdle: { backgroundColor: colors.primarySoft },
    barActive: { backgroundColor: colors.primary },
    barEmpty: { backgroundColor: colors.surfaceMuted },
    valueLabel: { ...typography.caption, fontWeight: "700", color: colors.primary, marginBottom: 2 },
    weekday: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
    weekdayActive: { color: colors.primary, fontWeight: "700" },
  });
