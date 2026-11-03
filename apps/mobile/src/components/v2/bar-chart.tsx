import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v2 周柱状图：7 列（可 5-7），value 0..1，highlight 表示"今天"。
 * 纯静态（动效在 S8 统一加），标签用 10-11pt 小字。
 */
export function BarChart({
  items,
  style,
  height = 96,
}: {
  items: { label: string; value: number; highlight?: boolean }[];
  style?: StyleProp<ViewStyle>;
  height?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.wrap, { height }, style]}>
      {items.map((item, index) => {
        const pct = Math.max(0, Math.min(1, Number.isFinite(item.value) ? item.value : 0));
        return (
          <View key={item.label + index} style={styles.col}>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: Math.max(3, pct * (height - 22)) }, item.highlight && styles.barActive]} />
            </View>
            <Text style={[styles.label, item.highlight && styles.labelActive]} numberOfLines={1}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingTop: 8 },
    col: { flex: 1, alignItems: "center", gap: 6 },
    barTrack: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
    bar: { width: "100%", maxWidth: 26, borderRadius: 6, backgroundColor: colors.primarySoft },
    barActive: { backgroundColor: colors.primary },
    label: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
    labelActive: { color: colors.primary, fontWeight: "700" },
  });
