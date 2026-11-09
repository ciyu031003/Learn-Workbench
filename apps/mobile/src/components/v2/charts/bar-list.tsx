import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { barShares, withAlpha } from "@/lib/chart-math";
import { ChartHeader } from "./chart-header";

export interface BarListItem {
  key?: string;
  label: string;
  /** 原始数值（决定占比条长度，不是百分比） */
  value: number;
  /** 右侧数值文案（默认显示 value） */
  valueLabel?: string;
  /** 名称下方明细小字 */
  hint?: string;
  color?: string;
}

/**
 * 排行 + 行内背景占比条（BoardUI 排行卡）：左侧名称/右侧数值，条形在行背景里。
 *
 * 占比宽度来自 `barShares`（已单测：可传 `max` 锁住多屏可比，负值/脏数据按 0）。
 * 用**百分比宽度 + overflow hidden** 而不是绝对像素：容器多宽条就多宽，不需要量宽。
 */
export function BarList({
  items,
  max,
  title,
  showRank = false,
  barOpacity = 0.14,
  onPressItem,
  style,
}: {
  items: BarListItem[];
  /** 条宽比例的上界；缺省取序列最大值 */
  max?: number;
  title?: string | null;
  showRank?: boolean;
  /** 背景条透明度（默认 0.14，浅到不抢文字） */
  barOpacity?: number;
  onPressItem?: (item: BarListItem) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shares = useMemo(() => barShares(items.map((item) => item.value), max), [items, max]);
  // 深色下同一条 alpha 会明显更弱，补一档让排行条还能看出长度
  const resolvedOpacity = dark ? Math.min(0.34, barOpacity + 0.08) : barOpacity;

  if (items.length === 0) {
    return (
      <View style={[styles.wrap, style]}>
        <ChartHeader title={title} />
        <Text style={styles.empty}>暂无数据</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <ChartHeader title={title} />
      <View style={styles.list}>
        {items.map((item, index) => {
          const color = item.color ?? colors.primary;
          const width = `${Math.max(2, (shares[index] ?? 0) * 100).toFixed(2)}%` as `${number}%`;
          const body = (
            <>
              <View
                pointerEvents="none"
                style={[styles.bar, { width, backgroundColor: withAlpha(color, resolvedOpacity) }]}
              />
              <View style={styles.content}>
                {showRank ? (
                  <Text style={[styles.rank, tabularNums]} numberOfLines={1}>
                    {index + 1}
                  </Text>
                ) : null}
                <View style={styles.labels}>
                  <Text style={styles.label} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Text style={styles.hint} numberOfLines={1}>
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.value, tabularNums]} numberOfLines={1}>
                  {item.valueLabel ?? String(item.value)}
                </Text>
              </View>
            </>
          );
          const key = item.key ?? `${item.label}-${index}`;
          if (!onPressItem) {
            return (
              <View key={key} style={styles.row}>
                {body}
              </View>
            );
          }
          return (
            <Pressable
              key={key}
              onPress={() => onPressItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} ${item.valueLabel ?? item.value}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              {body}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: "100%" },
    list: { gap: 6 },
    row: {
      position: "relative",
      overflow: "hidden",
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      minHeight: 40,
      justifyContent: "center",
    },
    pressed: { opacity: 0.82 },
    bar: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: radius.sm },
    content: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rank: { ...typography.caption, fontWeight: "700", color: colors.textFaint, width: 16 },
    labels: { flex: 1, gap: 1 },
    label: { ...typography.callout, fontWeight: "600", color: colors.text },
    hint: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    value: { ...typography.callout, fontWeight: "700", color: colors.text },
    empty: { ...typography.meta, color: colors.textMuted, paddingVertical: spacing.md },
  });
